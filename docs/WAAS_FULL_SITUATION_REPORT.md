# WAAS Site Transition — Pełny Raport Stanu Projektu

## Data: 13.03.2026
## Autor: raport dla nowej rozmowy / nowego developera
## Cel: dokończyć automatyczne stawianie stron affiliate na lk24.shop

---

## 1. CO TO JEST (kontekst biznesowy)

Łukasz prowadzi sieć ~31 stron Amazon Affiliate na subdomenach `*.lk24.shop`. Każda strona jest w innej niszy (Meißeltechnik = dłuta, Erdloch-Bohren = wiertła do ziemi, Reservekanister = kanistry, Rasenkante-Cortenstahl = obrzeża trawnikowe z cortenstahl, itd.).

Strony działają na **WordPress + Divi Theme + WooCommerce** na Hostingerze. Treści tworzone przez AI (Claude, Grok), zarządzane z Google Sheets przez Google Apps Script, wgrywane przez REST API.

**Model**: Klonuje się stronę-template (np. erdloch-bohren.lk24.shop) → nowa subdomena → automatycznie podmienia teksty, produkty, logo, menu → strona gotowa.

**Problem główny**: ten proces automatycznej tranzycji (od klona do gotowej strony) nie działa poprawnie. Mnóstwo ręcznej pracy zamiast automatyzacji.

---

## 2. CO ŁUKASZ CHCIAŁ (wizja od początku)

Wizja z sesji lutowej/marcowej (z session state):

1. Po sklonowaniu → usunięcie starych produktów
2. Pobranie WSZYSTKICH tekstów, **przepisanie ich** (nie tylko prompty!)
3. Dodanie nowych ustawień (partner tag, legal pages, SEO)
4. Wgranie tekstów **w to samo miejsce** (Divi layout ZACHOWANY!)
5. Usunięcie WSZYSTKIEGO co przypomina starą stronę (nazwy, linki, media)
6. Nowe: logo, tagi, meta, tytuł, opisy
7. Nowe posty blogowe (z Divi layoutem, nie plain HTML)
8. Dopasowanie menu, stron
9. Weryfikacja — site check

**Kluczowa zasada**: NIE RUSZAJ Divi layoutów! Klonujemy stronę i TYLKO podmieniamy teksty. Strony muszą wyglądać jak na template (z Divi modules: blurby, kolumny, CTA). NIE plain HTML.

---

## 3. ARCHITEKTURA TECHNICZNA

### 3.1 WordPress (na każdej stronie)

**Pluginy na stronach:**
- `waas-direct-publish.php` — MU-Plugin v1.3, REST API endpoints (`waas-pipeline/v1/`), 1798 linii
- `waas-settings.php` — Plugin v2.0, REST API endpoints (`waas-settings/v1/`), 1178 linii
- `waas-product-manager` — Custom post type + Amazon produkty
- `waas-patronage-manager` — System patronatu sprzedawców
- Divi Theme + Child Theme (`divi-child-waas`)
- WooCommerce, Rank Math SEO, Complianz GDPR, LiteSpeed Cache

**Dwa REST API namespace'y:**
- `waas-pipeline/v1/` — z mu-plugin `waas-direct-publish.php` (publish, update-content, extract-texts, replace-texts, cleanup, set-menu, set-branding, site-check)
- `waas-settings/v1/` — z plugin `waas-settings.php` (option, divi, postmeta, bulk-replace, bulk-meta, diagnostics, flush-cache, cleanup, branding, site-info)

**Auth**: Cookie + Nonce (login przez wp-login.php → cookies → nonce z admin-ajax.php). NIE Application Password dla pipeline operacji (choć AP istnieje w Sites sheet).

### 3.2 Google Sheets + Apps Script

**Spreadsheet** z kartami:
- `Sites` — 41+ kolumn (A-AP): ID, Site Name, Domain, WP URL, Admin Username, Admin Password, Divi API, Amazon Partner Tag, Status, App Password, Auth Type, Brand Display Name, Site Title, Product Category, Niche Keyword, Patronage fields, kolory, etc.
- `Content Pipeline` — ~60+ kolumn: artykuły z checkboxami (▶Text_CP, ▶ParseText_CP, ▶Image_CP, ▶Export_CP), sekcje JSON, SEO, FAQ
- `Media Queue_CP` — obrazy (prompty AI, URL-e, WP Media ID)
- `Video Queue_CP` — scenariusze wideo
- `Menu_CP` — definicje menu per domena
- `Category_Queue_CP` — kategorie WP
- `Products` — produkty Amazon (SP-API import)
- `Dropdowns_CP` — dane referencyjne

**Apps Script pliki** (pełna lista — w sekcji 6):
~35 plików .gs, w tym ContentPipeline*.gs (9 plików), SEO.gs, SiteCleanup.gs, WordPressAPI.gs, WordPressAuth.gs, Menu.gs, itd.

**Kluczowe helper functions:**
- `cpGetSiteData(domain)` — czyta Sites sheet, zwraca {id, name, domain, wpUrl, adminUser, adminPass, appPassword}
- `cpGetWPAuthForMedia(site, wpUrl)` — loguje przez wp-login.php, zwraca {cookies, nonce}
- `getAuthHeader(site)` — Basic Auth header (z WordPressAuth.gs, dla waas-settings/v1)
- `makeHttpRequest(url, options)` — HTTP z error handling (z Core.gs)
- `getSiteById(siteId)` — czyta Sites po ID (z SiteManager.gs)

**UWAGA**: Są DWA różne systemy auth i DWA zestawy helper functions:
1. **Pipeline system** (ContentPipeline*.gs): `cpGetSiteData()` + `cpGetWPAuthForMedia()` → cookie+nonce → namespace `waas-pipeline/v1`
2. **Legacy WAAS system** (SEO.gs, SiteCleanup.gs): `getSiteById()` + `getAuthHeader()` → Basic Auth → namespace `waas-settings/v1`

### 3.3 GitHub repo

**Repo**: `https://github.com/LUKOAI/LUKO-WAAS` (public)

**WAŻNE**: Repo zawiera STARY kod — pliki z `google-apps-script/` to wersja sprzed Content Pipeline. ContentPipeline*.gs i ContentPipelineTransition.gs **NIE SĄ W REPO** — istnieją tylko w Google Apps Script (wgrane przez clasp push). MU-plugin `waas-direct-publish.php` też nie jest w repo — jest tylko na serwerach.

Repo zawiera:
- `google-apps-script/` — 24 pliki (Core.gs, Menu.gs, SEO.gs, SiteManager.gs, WordPressAPI.gs, WordPressAuth.gs, SiteCleanup.gs, Automation.gs, etc.)
- `wordpress-plugin/waas-settings/waas-settings.php` — 1178 linii
- `wordpress-plugin/waas-product-manager/` — plugin
- `wordpress-plugin/waas-patronage-manager/` — plugin
- `wordpress-plugin/divi-child-waas/` — child theme
- `docs/`, `scripts/`, `monitoring/`, `b2b-saas/` — dokumentacja i narzędzia
- `dist/` — zipa pluginów

### 3.4 Divi Content Format

Strony używają **Divi 5 block format**:
```
<!-- wp:divi/placeholder -->
<!-- wp:divi/section {"builderVersion":"5.0.0-public-beta.8.2"} -->
<!-- wp:divi/row {...} -->
<!-- wp:divi/column {...} -->
<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"Tytuł"}}}} /-->
<!-- wp:divi/text {"content":{"innerContent":{"desktop":{"value":"\\u003cp\\u003eTreść\\u003c/p\\u003e"}}}} /-->
<!-- /wp:divi/column -->
<!-- /wp:divi/row -->
<!-- /wp:divi/section -->
<!-- /wp:divi/placeholder -->
```

**Kluczowe**: `\\u003c` = `<`, `\\u003e` = `>`, `\\u0022` = `"`. To jest w bazie danych (wp_posts.post_content). WordPress REST API wywołuje `wp_unslash()` co NISZCZY te escape'y — dlatego pipeline używa direct SQL (`$wpdb->update`) zamiast REST API do zapisywania treści.

Divi Classic (starsze strony) używa shortcodes: `[et_pb_text]...[/et_pb_text]`, `[et_pb_heading title="..."]` etc.

---

## 4. CO PRÓBOWANO I CO POSZŁO NIE TAK

### 4.1 Sesje luty 2026 — budowa pipeline

- Zbudowano Content Pipeline v4 (9 plików .gs)
- Prompt → Claude → JSON → Parse → Divi 5 blocks → Export do WP
- Przetestowano na meisseltechnik (10 artykułów) i reservekanister (4 artykuły)
- **Problem**: posty eksportowane jako Divi 5 blocks, ale mają tylko heading+text — brak blurbów, kolumn, CTA, tabel. Wyglądają jak "plain HTML z lat 90" (cytat usera)

### 4.2 Sesje marzec 2026 — transition automation

**Sesja 07-09.03.2026**: Stworzono ContentPipelineTransition.gs v3
- 8-krokowy auto pipeline z auto-resume (4.5 min safety margin)
- Claude API do rewrite page texts i generowania postów
- Przetestowano na rasenkante-cortenstahl
- **Odkryto bug**: endpoint `/extract-texts` nie wyciągał tekstów z większości stron

**Root cause bugu**: Regex w PHP szukał:
```
"content":{"desktop":{"value":"..."}}
```
Ale Divi 5 zapisuje:
```
"content":{"innerContent":{"desktop":{"value":"..."}}}
```
Brak `innerContent` wrapper w regex. Dlatego amazon-vorteile (który miał inny format) działał, a homepage, markenprofil, werkzeug-welt — nie.

### 4.3 Sesja 13.03.2026 (dzisiejsza) — fix + test

1. Sklonowałem repo z GitHub — zobaczyłem dokładny kod
2. Dostałem `waas-direct-publish.php` od usera
3. **Naprawiłem regex** — dodano `(?:\s*"innerContent"\s*:\s*\{)?` do 3 regexów + dodano ekstrakcję `subhead` i `body/description`
4. User wgrał spatchowany plik na serwer
5. **Test extract-texts**: homepage 0→2, markenprofil 0→22, werkzeug-welt 0→31 ✅
6. User odpalił Full Site Transition — 8/8 kroków passed
7. **Wynik**: rozczarowujący:
   - Menu wciąż stare (meisseltechnik) — transition pominął bo "brak w Menu_CP"
   - Strony częściowo przepisane ale wiele remnantów (stare nazwy Meißel, SDS HEX, itd. w Divi modułach)
   - Homepage wyciągnął tylko 2 teksty z ~20+ (blurby, CTA i inne moduły nie złapane)
   - Posty plain HTML (znany problem)
   - Logo brak
   - 934 starych mediów

### 4.4 Diagnoza problemu z extract-texts

Fix `innerContent` pomógł (z 0 do 2/22/31), ale extract-texts wciąż nie łapie WSZYSTKIEGO:
- Homepage ma blurby (`et_pb_blurb`), countery (`et_pb_counter`), CTA (`et_pb_cta`), fullwidth-header — regex łapie tylko `content` i `title` fields, nie inne atrybuty
- Niektóre moduły mają tekst w atrybutach których regex nie szuka (np. `percent`, `author`, `counter_title`)
- Blurb content w Divi 5 może być pod `body` zamiast `content`

### 4.5 Alternatywne podejście (zaproponowane dziś)

Zamiast parsowania Divi i AI rewrite, prosty **str_replace na surowej treści w bazie**:
- "Meißel" → "Rasenkante"
- "Fliesen entfernen" → "Cortenstahl verlegen"
- etc.

Stworzono `waas-deep-fix.php` (mu-plugin) z ~50 replacement pairs + tworzenie nowego menu. Jeszcze NIE wgrany, NIE przetestowany.

---

## 5. AKTUALNY STAN — rasenkante-cortenstahl.lk24.shop

| Element | Stan | Opis |
|---------|------|------|
| Legal pages | ✅ OK | Impressum, Datenschutz, Partnerhinweis zaktualizowane |
| Footer | ✅ OK | © 2026 RasenkanteCortenstahl |
| Partner tag | ✅ OK | rasenkante-cortenstahl-21 |
| Homepage treść | ⚠️ Częściowo | Hero przepisany, ale reszta (blurby, CTA) ma stare teksty |
| Markenprofil | ⚠️ Częściowo | Częściowo przepisany, wciąż ma WERHE, stare kontakty |
| Werkzeug-Welt | ⚠️ Częściowo | Przepisane headingi, ale stare nazwy produktów |
| Menu | ❌ Stare | Wciąż: Fliesen entfernen, SDS HEX, Meißel richtig einsetzen |
| Logo | ❌ Brak | Broken/placeholder |
| Blog posty | ⚠️ Draft | 3 posty (#2467, #2468, #2469) jako DRAFT, plain HTML nie Divi |
| Stare posty | ✅ Usunięte | Transition usunął stare |
| Media | ❌ 934 starych | Nie wyczyszczone |
| Slugi stron | ❌ Stare | Nadal meisseltechnik-style slugi |
| Kategorie | ❌ Brak | Tylko "Blog" |
| Site check | ⚠️ 11/17 (65%) | |

### Strony w WP (12):
| ID | Tytuł | Slug |
|----|-------|------|
| 70 | Premium Cortenstahl Rasenkanten... | homepage |
| 31 | Profi-Werkzeuge für Cortenstahl... | profi-werkzeuge-fuer-cortenstahl... |
| 166 | Markenprofil | markenprofil |
| 28 | Werkzeug Ratgeber für Cortenstahl... | werkzeug-ratgeber-fuer-cortenstahl... |
| 2452 | Cortenstahl-Rasenkanten bei Amazon | cortenstahl-rasenkanten-bei-amazon-bestellen |
| ? | Cortenstahl-Rasenkanten Anleitungen | cortenstahl-rasenkanten-anleitungen-projekte |
| ? | Cortenstahl-Ratgeber (blog page) | cortenstahl-ratgeber... |
| ? | Shop | shop |
| ? | Warenkorb | warenkorb |
| ? | Impressum | impressum |
| ? | Datenschutzerklärung | datenschutzerklaerung |
| ? | Amazon-Partnerhinweis | amazon-partnerhinweis |

---

## 6. PEŁNA LISTA PLIKÓW Apps Script (w Google Sheets)

**Z repo (`LUKOAI/LUKO-WAAS/google-apps-script/`):**
```
appsscript.json
AmazonPA.gs
Automation.gs
ContentGenerator.gs
Core.gs               — getAPIKey, makeHttpRequest, makeHttpRequestWithRetry, logging
DiviAPI.gs
LaunchReport.gs
Menu.gs                — onOpen() z kompletnym menu WAAS
ProductImportHelper.gs
ProductManager-PRICE-WEBHOOK.gs
ProductManager-WOOCOMMERCE-EXPORT.gs
ProductManager.gs
SearchEngines.gs
SEO.gs                 — setupRankMathOrg, fixPartnerTag, deployProductMeta, runSeoHealthCheck
setup.gs
SiteCleanup.gs         — cleanupClonedSite, updateSiteBranding, getSiteFullInfo
SiteManager.gs         — getSiteById, updateSiteStatus, checkSiteStatus
TaskManager.gs
WooStructureAutomation.gs
WordPressAPI.gs        — createWordPressPost, uploadMediaToWordPress, getInstalledPlugins
WordPressAuth.gs       — getAuthHeader, setupWordPressAuth, createApplicationPassword
sp-api/MenuIntegration-SPApi-WAAS.gs
sp-api/SPApiAuth-WAAS.gs
sp-api/SPApiDataCollection-WAAS.gs
```

**NIE w repo (tylko w Google Apps Script) — ContentPipeline system:**
```
ContentPipeline.gs              — CP_CONFIG, cpGenerateContentId, cpSetupPipelineColumns, cpBuildDivi5Content
ContentPipelineEngine.gs        — cpGenerateTextPrompts, cpParseTextResponses, cpExportToWordPress, cpPublishToWP, cpGetSiteData, cpBuildDivi5Content (v4.2)
ContentPipelineReorg.gs         — cpReorganizeSheet, cpCompactView, cpShowAllColumns
ContentPipelineAI.gs            — cpCallAI (Grok/OpenAI/Claude wrapper), cpSetupAPIKeys
ContentPipelineAuto.gs          — cpAutoGenerate, cpProcessAutoJob, cpFetchResearch, cpStage1Plan, cpStage2Write
ContentPipelineSystemPrompt.gs  — cpGetPlanningSystemPrompt, cpGetWritingSystemPrompt, cpGetWritingJsonSchema
ContentPipelineImages.gs        — cpGenerateImagePromptsAI, cpGenerateImages (Grok API), cpUploadImagesToWP, cpGetWPAuthForMedia
ContentPipelineImageAssign.gs   — cpAssignImagesToPosts, _cpAssignFeaturedImages, _cpInsertIllustrations, _cpProtectBackslashes
ContentPipelineSetup_v43.gs     — cpSetupV43Additions (Post_Type_CP, Existing_Post_ID_CP, Category_Queue_CP)
ContentPipelinePhase2.gs        — cpSetupPhase2, cpVerifySite, cpSetBranding
ContentPipelinePages.gs         — cpGenerateLogo, cpDeployBranding, cpGetPageStructure, cpBuildPagePrompt, cpGenerateSitePages
ContentPipelineMenu.gs          — cpSetupMenuSheet, cpDeployMenu, cpImportMenu
ContentPipelineVideo.gs         — cpSetupVideoQueue, cpProcessVideoThumbnails, cpEmbedVideosInPosts
ContentPipelineTransition.gs    — cpSiteTransition, cpTransitionResume, 8-step auto pipeline
```

### Kluczowe zależności:
- `ContentPipelineEngine.gs` definiuje `cpGetSiteData()` i `cpBuildDivi5Content()` — używane przez wszystkie inne CP pliki
- `ContentPipelineImages.gs` definiuje `cpGetWPAuthForMedia()` — używane przez Transition i Export
- `ContentPipelineTransition.gs` używa: `cpGetSiteData`, `cpGetWPAuthForMedia`, `_cpCleanupCall` (własny helper), `_tsCallClaude` (własny Claude caller)
- Menu.gs `onOpen()` ma kompletne menu ze WSZYSTKIMI funkcjami

---

## 7. PEŁNA LISTA PLIKÓW WordPress (mu-plugins)

**Na serwerach (mu-plugins/):**
```
waas-direct-publish.php  — v1.3, 1798 linii, namespace waas-pipeline/v1
                           13 endpoints: publish, update-content, update-legal, export-category,
                           verify, find-page, set-branding, site-check, set-menu,
                           get-site-structure, cleanup, extract-texts, replace-texts
```

**Deployed na:**
- rasenkante-cortenstahl.lk24.shop — v1.3 (z fixem innerContent)
- reservekanister.lk24.shop — v1.4 (starsza wersja z dodatkowymi endpointami)
- Pozostałe 29 stron — v1.2 lub starsza (BEZ extract-texts, replace-texts, cleanup, set-menu)

**W repo (plugin, nie mu-plugin):**
```
waas-settings.php — v2.0, 1178 linii, namespace waas-settings/v1
                    Endpoints: option, divi, postmeta, bulk-replace, bulk-meta,
                    diagnostics, flush-cache, deploy-mu-plugin, cleanup, branding,
                    site-info, gsc-verify, bing-verify, price-sync, auth-setup, auth-test
```

---

## 8. CO KONKRETNIE NIE DZIAŁA I DLACZEGO

### 8.1 extract-texts nie łapie wszystkiego
**Problem**: Regex szuka tylko `content`, `title`, `button_text`, `subhead`, `body/description`. Ale Divi 5 moduły mają ~15+ różnych pól tekstowych. Blurby, countery, testimoniale, taby, toggles, CTA — każdy ma inne atrybuty.
**Skutek**: Homepage wyciąga 2 teksty z ~20+.
**Rozwiązanie**: Zamiast parsowania, użyć prostego str_replace na surowej treści.

### 8.2 Rewrite via AI jest kruchy
**Problem**: Claude dostaje listę tekstów, przepisuje je, zwraca JSON z replacements. Ale:
- Jeśli extract nie złapał tekstu — AI go nie przepisze
- AI czasem obcina odpowiedź (za dużo tekstów → JSON za długi → obcięty)
- AI zmienia długość tekstu co może zepsuć layout
- Markenprofil (22 teksty) → Claude error (za dużo)
**Skutek**: Częściowe przepisanie, pomieszane stare i nowe teksty.
**Rozwiązanie**: str_replace jest deterministyczny i łapie WSZYSTKO.

### 8.3 Menu nie tworzone automatycznie
**Problem**: Transition sprawdza Menu_CP sheet. Jeśli brak wierszy dla domeny → skip. Powinien automatycznie stworzyć menu z istniejących stron.
**Skutek**: Stare menu meisseltechnik.

### 8.4 Posty plain HTML
**Problem**: Divi 5 content generowany przez `cpBuildDivi5Content()` tworzy tylko section→row→column→heading+text. Brak blurbów, kolumn 2/3, CTA boxes, tabel, counter bars, testimoniali — wszystko co czyni stronę ładną.
**Skutek**: Posty wyglądają jak z lat 90.
**Rozwiązanie prawdziwe**: Klonować post z template (erdloch-bohren), wyciągnąć layout, podmienić teksty. NIE generować layoutu od zera.

### 8.5 Logo nie generowane w transition
**Problem**: Transition v3 nie ma kroku "Generate Logo". Jest osobny flow: `cpGenerateLogo()` → Media Queue → Grok API → Upload → `cpDeployBranding()`.
**Skutek**: Brak logo po transition.

### 8.6 Media nie czyszczone
**Problem**: 934 starych plików (obrazy z meisseltechnik). Transition nie ma kroku "delete old media".
**Skutek**: Bałagan w Media Library.

### 8.7 Disclosure w postach
**Problem**: User wielokrotnie mówił: disclosure ("Als Amazon-Partner...") NIE MOŻE być w treści posta. Ma być w footer i na stronie /partnerhinweis/. AI generując posty wstawia disclosure na początku.
**Skutek**: Disclosure widoczny w excerptach na blogu.

---

## 9. NIEGOTOWY SKRYPT waas-deep-fix.php

Stworzony dziś, NIE wgrany, NIE testowany. Podejście str_replace:
- ~50 par zamienników (Meißel→Rasenkante, Fliesen entfernen→Cortenstahl verlegen, etc.)
- Zamienia w: post_content, post_title, postmeta (RankMath), options
- Tworzy nowe menu (7 pozycji)
- Dostępny przez wp-admin → Werkzeuge → Deep Fix
- Najpierw SCAN (pokazuje co znajdzie), potem FIX EVERYTHING

**Brakuje w nim**: czyszczenie mediów, fix slugów, logo, fix postów (plain HTML→Divi).

---

## 10. CO POTRZEBA ŻEBY TO DZIAŁAŁO

### Minimum (żeby rasenkante-cortenstahl wyglądała OK):
1. str_replace na WSZYSTKIM w bazie (stare→nowe nazwy)
2. Nowe menu (7 pozycji z istniejących stron)
3. Usunięcie 934 starych mediów
4. Fix slugów stron
5. Logo (Grok API lub ręcznie)
6. Publikacja 3 draftów (albo usunięcie i regeneracja z lepszym layoutem)

### Docelowo (żeby transition działał na KAŻDEJ nowej stronie):
1. Zastąpić extract→AI→replace prostym str_replace z mapą zamienników per nisza
2. Auto-menu z istniejących stron
3. Logo generation w transition flow
4. Klonowanie postów z template (nie generowanie od zera)
5. Media cleanup
6. Slug rename
7. Deploy mu-plugin na wszystkie strony

---

## 11. DOSTĘP — DOKŁADNE LOKALIZACJE

### 11.1 GitHub (cały kod)
| Co | Gdzie |
|----|-------|
| Repo | https://github.com/LUKOAI/LUKO-WAAS (public) |
| GAS pliki (37) | `google-apps-script/*.js` |
| WP plugin waas-settings | `wordpress-plugin/waas-settings/waas-settings.php` |
| WP plugin waas-product-manager | `wordpress-plugin/waas-product-manager/` |
| WP plugin waas-patronage-manager | `wordpress-plugin/waas-patronage-manager/` |
| Divi child theme | `wordpress-plugin/divi-child-waas/` |
| Dokumentacja | `docs/`, `DEPLOYMENT_GUIDE.md`, `README.md` |

**UWAGA**: `waas-direct-publish.php` (mu-plugin) NIE jest w repo — jest tylko na serwerach Hostinger.

### 11.2 Komputer lokalny (desktop Łukasza)
| Co | Ścieżka |
|----|---------|
| Repo lokalne | `C:\Users\user\LUKO-WAAS\` |
| GAS pliki | `C:\Users\user\LUKO-WAAS\google-apps-script\` |
| Clasp config | `C:\Users\user\LUKO-WAAS\.clasp.json` |
| Clasp Script ID | `1NYsatXvFelKcwZhG5D4RUzAvqW5oeKcdXoJL3A6Yd_Ogy4Jf88BRX5J-` |

**Sync GAS → GitHub**: `cd C:\Users\user\LUKO-WAAS && clasp pull && git add google-apps-script/ && git commit -m "sync GAS" && git push origin main`

### 11.3 Google Sheets + Apps Script
| Co | Gdzie |
|----|-------|
| Spreadsheet ID | `1oQnaP62owx0H2ZVpyXoLXWRGehhN81QrhNSb1Y-SV_4` |
| Apps Script | W tym spreadsheet → Extensions → Apps Script |
| Script ID | `1NYsatXvFelKcwZhG5D4RUzAvqW5oeKcdXoJL3A6Yd_Ogy4Jf88BRX5J-` |
| Claude API key | Apps Script → Project Settings → Script Properties → `CLAUDE_API_KEY` |
| Grok API key | Apps Script → Project Settings → Script Properties → `GROK_API_KEY` |
| WAAS Menu | W spreadsheet: menu ⚡ WAAS (u góry po otwarciu) |

**Karty (sheets)**: Sites, Content Pipeline, Media Queue_CP, Video Queue_CP, Menu_CP, Category_Queue_CP, Dropdowns_CP, Products, Logs

### 11.4 Hostinger — serwery WordPress
| Co | Ścieżka na serwerze |
|----|---------------------|
| MU-Plugin (pipeline) | `wp-content/mu-plugins/waas-direct-publish.php` |
| Plugin waas-settings | `wp-content/plugins/waas-settings/waas-settings.php` |
| Plugin waas-product-manager | `wp-content/plugins/waas-product-manager/` |
| Plugin waas-patronage-manager | `wp-content/plugins/waas-patronage-manager/` |
| Divi child theme | `wp-content/themes/divi-child-waas/` |
| Footer override (opcjonalny) | `wp-content/mu-plugins/waas-footer-override.php` |

**Dostęp do File Manager**: Hostinger panel → Websites → [domena] → File Manager → public_html/

**Wersje mu-plugin na stronach**:
- rasenkante-cortenstahl.lk24.shop — v1.3 (z fixem innerContent)
- reservekanister.lk24.shop — v1.2
- Pozostałe ~29 stron — v1.2 lub starsza (BEZ extract-texts, replace-texts, cleanup)

### 11.5 WordPress admin
| Co | URL |
|----|-----|
| Główna testowa strona | https://rasenkante-cortenstahl.lk24.shop/wp-admin/ |
| Template strona | https://erdloch-bohren.lk24.shop/wp-admin/ |
| Credentials | W Sites sheet: kolumna E (Admin Username), F (Admin Password) |
| Typowy login | `netanalizaltd` / `WIL6628E!abc` (lub warianty — sprawdź Sites) |

### 11.6 REST API endpoints (dwa namespace'y!)

**waas-pipeline/v1/** (z mu-plugin `waas-direct-publish.php`, auth: cookie+nonce):
```
POST /publish              — twórz post/page (direct SQL)
POST /update-content       — aktualizuj post/page
POST /update-legal         — legal pages + footer + partner tag
POST /export-category      — twórz/aktualizuj kategorię
GET  /verify/{id}          — weryfikuj encoding
GET  /find-page/{slug}     — znajdź stronę po slug
POST /set-branding         — logo + favicon + kolor
GET  /site-check           — 17-point verification
POST /set-menu             — twórz/zastąp menu
GET  /get-site-structure   — strony, kategorie, posty, menu
POST /cleanup              — delete posts/products/tags, scan/clean remnants, inventory
GET  /extract-texts/{id}   — wyciągnij teksty z Divi (NAPRAWIONY v1.3)
POST /replace-texts        — find-replace w Divi content
```

**waas-settings/v1/** (z plugin `waas-settings.php`, auth: Basic Auth):
```
GET/PUT /option            — czytaj/zapisz wp_options
GET/PUT /divi              — Divi theme options
GET/PUT /postmeta/{id}     — post meta (RankMath)
POST    /bulk-replace      — masowy find-replace w DB
POST    /bulk-meta         — masowe meta descriptions
GET     /diagnostics       — info o stronie
POST    /flush-cache       — czyść cache
POST    /deploy-mu-plugin  — wgraj mu-plugin
POST    /cleanup           — usuń content (products, posts, taxonomies, media)
PUT     /branding          — blogname + tagline
GET     /site-info         — pełna info o stronie
POST    /auth-setup        — stwórz Application Password
```

### 11.7 Jak odpalić WAAS
1. Otwórz Google Sheets (Spreadsheet ID powyżej)
2. Poczekaj na załadowanie menu ⚡ WAAS (u góry)
3. Wybierz akcję z menu (np. WAAS → Transition → 🔄 Full Site Transition)
4. Logi: View → Execution log w Apps Script, lub karta Logs w spreadsheet

---

*Raport: 16.03.2026 (zaktualizowany)*
