# Session Summary — Keyword Batch + WC Export Hardening (May 2026)

Branch: `claude/automate-keyword-copy-esrZ1`
Repo: github.com/LUKOAI/LUKO-WAAS

## Cel sesji

Wyeliminować mozolne, ręczne kroki w workflow:
- importu produktów z Amazon SP-API przez frazy wyszukiwania
- masowego zaznaczania ASIN-ów do eksportu (operator wkleja listę od asystenta AI)
- eksportu Products → WooCommerce bez nadzoru, z duplikatami zdjęć i timeoutami

## Co zostało zrobione — funkcjonalnie

### 1. Search_Keywords sheet + batch search (SP-API)
**Plik:** `google-apps-script/sp-api/SPApiKeywordBatch-WAAS.gs` (nowy)

- Nowa karta arkusza `Search_Keywords` z kolumnami: ID, Keyword, Marketplace (dropdown DE/FR/UK/IT/ES/NL/BE/PL/SE/IE, domyślnie DE), Limit (domyślnie 10), Search (checkbox), Status, Last Search Date, Found, Imported, Notes.
- `spSetupSearchKeywordsSheet()` — tworzy/naprawia kartę, ustawia dropdowny, formatowanie warunkowe (DONE zielony, FAILED czerwony, PENDING żółty).
- `spRunKeywordBatch()` — iteruje wiersze `Search = TRUE`, sekwencyjnie wywołuje `spSearchProducts` + `spFetchAndWriteProducts`, po sukcesie zamienia checkbox na `DONE` + datę.
- Soft-timeout 5 min, auto-instalacja triggera kontynuacji `spRunKeywordBatchContinuation` jeśli zostaną PENDING wiersze.
- Menu: `WAAS → SP-API Import → Run Keyword Batch (from sheet)`.

### 2. Bulk Mark / Unmark ASINs w Products
**Plik:** `google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs`

- `productsBulkMarkByAsins()` — 2-step prompt (domena z listy Sites + multi-line ASIN/ISBN-10 input), regex `\b(B[0-9A-Z]{9}|[0-9]{9}[0-9X])\b` wyłapuje ASIN-y Amazon i ISBN-10 (książki) z dowolnego tekstu, ustawia `Select=TRUE` + `Target Domain` dla dopasowanych wierszy.
- `productsBulkUnmarkByAsins()` — odwrotne: czyści Select i Target Domain. Z bezpiecznikiem na wiersze `Select=DONE` (już wyeksportowane).
- Menu: `WAAS → WooCommerce Export → Bulk Mark / Bulk Unmark`.

### 3. Auto-resume WC Export (z odpornością na 6-min Apps Script kill)
**Plik:** `google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs`

- `_exportSelectedInternal()` z **LockService** zapobiegającym równoległym runom (menu + trigger).
- Marker `Select=IN_PROGRESS` ustawiany PRZED requestem do WP — gdy Apps Script ucina skrypt w środku, wiersz NIE wraca do kolejki przy następnym runie.
- Recovery: na starcie każdego runa skanuje IN_PROGRESS i resetuje do TRUE (lock gwarantuje że nic ich nie procesuje).
- Soft-timeout 5 min → `_exportSelectedScheduleContinuation()` (+30s trigger).
- `resumeExportNow()` — manualne wznowienie z menu.
- `wcExportCleanupAllTriggers()` — czyszczenie zombie triggerów + reset LockService.
- Menu: Export Selected, Resume Export Now, Clean Up Stuck Export Triggers.

### 4. Image source selection (po analizie SP-API layoutu)
**Plik:** `google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs`

- `_collectProductImagesFromColumns()` — bierze **dokładnie 4 sztywne kolumny**: `Image0Source`, `Image1Source`, `Image4Source`, `Image7Source`.
- Powód: SP-API konsekwentnie umieszcza thumbnaile `_SL75_` w slotach 3, 6, 9. Slot 0 to główne zdjęcie. Pozostałe wybrane sloty to inne ujęcia.
- `images_sources` (CSV) celowo ignorowany — 4 zdjęcia per karta produktu wystarczy.
- Fallback: jeśli `Image0Source` pusty, używa `FeaturedImageSource`.

### 5. WP plugin — fixy strukturalne
**Plik:** `wordpress-plugin/waas-product-manager/includes/class-rest-api-v2.php`

- **Featured image restore:** po pętli gallery wymuszone `set_post_thumbnail($product_id, $featured_id)`. Wcześniej `set_product_image_from_url` w każdej iteracji nadpisywała featured ostatnim obrazkiem — efekt: featured = ostatni z gallery → wizualne duplikaty.
- **Force thumbnail regen:** po `media_handle_sideload` wymuszone `wp_generate_attachment_metadata` z `set_time_limit(60)`. Dla dużych źródłowych obrazków (Amazon 2000×2000) WordPress czasami nie generuje wszystkich rozmiarów cicho — efekt: produkt wyświetla oryginał w kontenerze 600px, theme tnie ugly. Drugie wywołanie z większym time limit naprawia.
- **Dedupe endpoint:** `POST /waas/v1/media/dedupe?limit=500&dry_run=bool` — jednorazowe czyszczenie historycznej media library. Grupuje attachmenty po canonical URL, zostawia największy w grupie, naprawia referencje produktów (featured + gallery), usuwa pozostałe. Druga faza: usuwa thumbnaile <600px nawet bez większego rodzeństwa.
- **Source URL meta normalization:** `_waas_source_url` zapisywane w formie canonical (po stripie wariantów rozmiarowych), żeby `find_existing_attachment_by_source_url` znajdowało duplikaty przy re-eksporcie.
- **`normalize_amazon_image_url()`:** PHP helper strippujący `._SX300_`, `._AC_UL900_`, `._SS300_QL70_FMwebp_`, `._SL75_` etc. do canonical hash.

### 6. Menu rozszerzenia
**Plik:** `google-apps-script/Menu.gs`

Pełen plik (1268 linii) zaktualizowany ze wszystkimi dodatkami operatora, plus:
- `SP-API Import → Run Keyword Batch (from sheet)`
- `WooCommerce Export → Bulk Mark ASINs (Select + Domain)`
- `WooCommerce Export → Bulk Unmark ASINs (clear Select + Domain)`
- `WooCommerce Export → Resume Export Now`
- `WooCommerce Export → Clean Up Stuck Export Triggers`
- `WooCommerce Export → Dedupe Media Library`
- `onOpen` self-heal: toast jeśli są pending `Select=TRUE` wiersze (zachęca do Resume Export Now)

## Co działa stabilnie (potwierdzone w produkcji videamut.de)

- Keyword batch — operator wpisuje frazy, klika menu, system iteruje sekwencyjnie. Auto-wznowienie po timeout.
- Bulk Mark/Unmark — wkleja ASIN-y z czata AI, zaznacza w Products. Akceptuje ASIN-y Amazon i ISBN-10.
- WC Export — leci ~15s/produkt, single export per ASIN, zero równoległych runów. Po 1900 produktach (połowa batcha) operator potwierdza brak duplikatów obrazków.
- 4 zdjęcia per produkt z konkretnych kolumn — przewidywalne, czyste, bez heurystyk.
- Auto-resume cykl: Apps Script 5min soft-timeout → trigger +30s → kolejny cykl. Powtarza się aż kolumna Select=TRUE = 0.

## Co miało być a okazało się problematyczne

### Problemy zdiagnozowane i naprawione

1. **Concurrency** — menu click + auto-resume trigger leciały równolegle, każdy łapał te same Select=TRUE wiersze. Naprawione: `LockService.getScriptLock()` z `tryLock(2000)` + `finally releaseLock`.

2. **6-min Apps Script hard kill mid-request** — WordPress kończył przetwarzanie po ucięciu skryptu, ale GAS nie dostawał response → Select zostawało TRUE → re-export tego samego produktu. Naprawione: `Select=IN_PROGRESS` zapisane PRZED requestem, recovery przy starcie nowego runa.

3. **Apps Script zombie executions** — UI Apps Script pokazuje "Running" dla starych ubitych egzekucji przez wiele godzin. To **wyłącznie display bug Google**, nie wpływa na rzeczywiste runy. Naprawione przez `wcExportCleanupAllTriggers()` która kasuje wszystkie wiszące triggery i probuje LockService.

4. **OPcache na Hostingerze** — podmieniony plik PHP nie był ładowany do nowych requestów. Plugin używał starego kodu. Workaround: Deactivate + Activate plugin po każdej zmianie PHP.

5. **WP plugin featured-overlap** — `set_product_image_from_url` zawsze wywoływało `set_post_thumbnail` na końcu, więc po pętli featured = ostatni gallery item. Produkt pokazywał ten sam obrazek 2× (jako featured + jako ostatni gallery). Naprawione: explicit `set_post_thumbnail($product_id, $featured_id)` po pętli.

6. **Image dedup po URL nie wystarcza** — Amazon SP-API zwraca tę samą fotkę pod kilkoma kanonicznymi hashami (jeden dla 2000×2000, drugi dla 500×500). URL-em się tego nie połączy. Próbowane: normalizacja wariantów (działa dla `_SL75_`), filtr <600px (działa ale ryzyko dla legit małych zdjęć). **Ostateczne rozwiązanie:** zignorować problem URL dedup, brać po prostu 4 sztywne kolumny które operator zidentyfikował jako "zawsze unikalne pełnego rozmiaru".

7. **Brakujące intermediate sizes** dla dużych źródeł — `media_handle_sideload` cicho nie generował `thumbnail/medium/large/shop_single` dla 2000×2000+ obrazków przy ograniczonej pamięci PHP. Naprawione: explicit `wp_generate_attachment_metadata` + `set_time_limit(60)` po sideload.

8. **Tysiące historycznych duplikatów** w media library z eksportów sprzed wszystkich fixów. Naprawione: jednorazowy endpoint `POST /waas/v1/media/dedupe`, plus operator uruchamia darmowy plugin "Regenerate Thumbnails" dla starych attachmentów bez miniatur.

### Problemy NIE rozwiązane (świadomie odpuszczone)

1. **Książki obcięte w miniaturze** — portretowe ratio książek nie mieści się dobrze w 1:1 thumbnail. Operator akceptuje.

2. **Edge case: Amazon serving same physical image at multiple canonical hashes** — gdyby zachciało nam się 100% pewności, trzeba by hash-content comparison po pobraniu. Pominięte, bo wybór 4 sztywnych kolumn (Image0/1/4/7) statystycznie eliminuje problem.

3. **Apps Script quota** — przy ~15s/produkt i 6-min cyklu, eksport 3000+ produktów zajmuje kilkanaście godzin auto-resume. Operator akceptuje (działa w tle).

## Bug, którego nie znaleźliśmy szybko

Sesja straciła kilka godzin na podążanie złym tropem: szukanie w GAS i normalizacji URL, gdy realny bug był w PHP plugin (set_post_thumbnail overwrite + brak thumbnail regen). Operator wielokrotnie wskazywał objaw, ja proponowałem coraz bardziej skomplikowane warstwy dedup zamiast spojrzeć w plugin code path. Lekcja: gdy operator mówi "widzę duplikaty na karcie produktu", patrz najpierw w PHP renderingu, nie w GAS-ie wysyłającym.

## Kluczowe commity (chronologicznie)

```
0849ab5  feat: SP-API keyword batch search from Search_Keywords sheet
65a2e76  feat: keyword batch auto-resume + bulk-mark ASINs
f67c9a8  feat: productsBulkUnmarkByAsins
dbf0a2c  feat: auto-resume WooCommerce export
99e0014  feat: bulk-mark accepts ISBN-10
1fc8237  fix: serialize WC export with LockService
564bf29  fix: WP plugin restores featured image to first entry
0010f71  fix: mark Select=IN_PROGRESS before WP request
0fb6724  feat: one-shot media library dedupe endpoint
fbe1916  fix: discard sub-600px attachments (later reverted)
9a0ec3c  feat: pull product images from fixed columns Image0/1/4/7Source
ab9518b  fix: force wp_generate_attachment_metadata after sideload
```

## Pliki do podmiany — referencja

- `google-apps-script/Menu.gs` (1268 linii)
- `google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs`
- `google-apps-script/sp-api/SPApiKeywordBatch-WAAS.gs` (nowy)
- `wordpress-plugin/waas-product-manager/includes/class-rest-api-v2.php`

Linki raw na branchu `claude/automate-keyword-copy-esrZ1`:
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/Menu.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/sp-api/SPApiKeywordBatch-WAAS.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/wordpress-plugin/waas-product-manager/includes/class-rest-api-v2.php
