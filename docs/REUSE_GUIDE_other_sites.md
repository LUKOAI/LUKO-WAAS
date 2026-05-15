# Wdrożenie na innej stronie / domenie — Guide

Wszystkie zmiany z sesji `claude/automate-keyword-copy-esrZ1` są **uniwersalne** —
nie ma kodu specyficznego dla videamut.de. To czysta logika importu + eksportu
która zadziała na każdej stronie WAAS niezależnie od niszy/języka/marki.

## Co jest uniwersalne (zero adaptacji)

### Apps Script (Google Sheets)

Te pliki/zmiany przenosisz dosłownie kopiuj-wklej. Każdy arkusz WAAS ma tę samą
strukturę (Sites, Products, ewentualnie Search_Keywords po setup).

| Plik | Akcja |
|---|---|
| `Menu.gs` | Podmień całość — submenu `SP-API Import` i `WooCommerce Export` zyskują nowe pozycje |
| `ProductManager-WOOCOMMERCE-EXPORT.gs` | Podmień całość — cała nowa logika eksportu |
| `SPApiKeywordBatch-WAAS.gs` | **Nowy plik** — utwórz w edytorze Apps Script, wklej zawartość |

Po pierwszym otwarciu arkusza:
1. `WAAS → SP-API Import → Setup Search Keywords Sheet` (jednorazowo, tworzy kartę Search_Keywords)
2. Zaznacz checkboxy w arkuszu Sites dla nowej domeny (Domain, Amazon Partner Tag itd.)

### WordPress plugin

Plik `waas-product-manager/includes/class-rest-api-v2.php` jest **uniwersalny** —
nie ma w nim niczego site-specific. Każda strona z plugin'em `waas-product-manager`
otrzymuje tę samą poprawkę.

Procedura per nowa strona:
1. **Hostinger File Manager / FTP:** podmień `class-rest-api-v2.php`
2. **WP Admin → Plugins:** Deactivate `WAAS Product Manager` → Activate (clear OPcache)
3. **WP Admin → Plugins → Add New:** zainstaluj **"Regenerate Thumbnails"** (Alex Mills)
4. **Tools → Regenerate Thumbnails:** klik "Regenerate Thumbnails For All X Attachments" — czeka kilkanaście minut
5. Po zakończeniu: deaktywuj i usuń plugin Regenerate Thumbnails

## Co może wymagać dopasowania per strona

### 1. Liczba i wybór kolumn obrazków

W `_collectProductImagesFromColumns()` jest sztywny wybór 4 kolumn:
```javascript
const slots = ['image0source', 'image1source', 'image4source', 'image7source'];
```

Powstał z obserwacji SP-API layout u operatora videamut.de. W praktyce ten układ
jest spójny dla wszystkich produktów Amazon (sloty 3, 6, 9 to zawsze `_SL75_`
thumbnaile). **Powinno działać bez zmian na każdej innej domenie.**

Jeśli chcesz więcej zdjęć per produkt (np. 7 dla niszy gdzie multi-angle ma
znaczenie), zmień slots na:
```javascript
const slots = ['image0source', 'image1source', 'image2source',
               'image4source', 'image5source',
               'image7source', 'image8source'];
```

To dalej omija sloty 3/6/9 (thumbnaile) i daje 7 unikalnych pełnych zdjęć.

### 2. Czas timeout dla auto-resume

W `_exportSelectedInternal`:
```javascript
const deadline = startTime + (5 * 60 * 1000); // 5 min
```

To soft-timeout. Hard-kill Apps Script jest na 6 min. Jeśli WordPress hostingu
jest wolny i pojedynczy eksport produktu zajmuje 30s+, możesz mieć tylko ~10
produktów per cykl. Wtedy auto-resume działa, ale wolniej. Można zostawić bez
zmian.

### 3. Trigger delay między cyklami

```javascript
.after(30 * 1000) // 30 seconds
```

30 sekund między cyklami auto-resume to balance między szybkością a daniem Apps
Script czasu na cleanup. Jeśli masz dużą bazę (10k+ produktów) i jakość połączenia
jest dobra, możesz spróbować zostawić jak jest.

### 4. Dimension threshold w dedup endpoint

W `class-rest-api-v2.php` w `dedupe_media_library`:
```php
$min_side = 600;
```

600px to próg "mały thumbnail vs prawdziwa fotka". Działa dla typowych produktów
Amazon. Jeśli twoja nisza ma legitymne małe zdjęcia (np. drobne ikony) — zwiększ
do 400px lub mniej.

## Procedura wdrożenia nowej strony — krok po kroku

### A. Setup Google Sheets (jednorazowo dla nowej strony)
1. Wpisz nową domenę w karcie `Sites` (z Amazon Partner Tag, WordPress URL, credentials).
2. W karcie Products: zaznacz checkboxy `Select` dla ASIN-ów które chcesz eksportować + ustaw `Target Domain` na nową domenę.

### B. Setup Apps Script (jeśli to nowy projekt; jeśli wspólny — pomijasz)
1. Otwórz Apps Script Editor.
2. Podmień `Menu.gs` na wersję z gita.
3. Podmień `ProductManager-WOOCOMMERCE-EXPORT.gs`.
4. Utwórz `SPApiKeywordBatch-WAAS` (nowy plik).
5. Sprawdź że są też pliki: `SPApiAuth-WAAS.gs`, `SPApiDataCollection-WAAS.gs` (zależności).
6. Zapisz, przeładuj arkusz.

### C. Setup WordPress (per strona, raz)
1. Wgraj WAAS Product Manager plugin (jeśli świeży) i aktywuj.
2. Podmień `class-rest-api-v2.php` na wersję z gita.
3. Deactivate + Activate `WAAS Product Manager`.
4. Zainstaluj plugin **Regenerate Thumbnails**.
5. Tools → Regenerate Thumbnails → klik raz dla wszystkich obecnych obrazków
   (jeśli to nowa strona, lista będzie pusta — pomijasz).
6. Deactivate + Delete Regenerate Thumbnails.

### D. Pierwsze użycie
1. `WAAS → SP-API Import → Setup Search Keywords Sheet` (jednorazowo).
2. W Search_Keywords wpisz pierwsze frazy: keyword, marketplace (domyślnie DE),
   limit (domyślnie 10), checkbox Search.
3. `WAAS → SP-API Import → Run Keyword Batch` — odpalasz, czekasz aż się zakończy
   (z auto-resume jeśli długo).
4. W Products: pojawiają się zaimportowane ASIN-y z marketplace DE.
5. Decydujesz które chcesz mieć na stronie. Najprościej: wyniki wklejasz do
   drugiego czata AI ("które z tych ASIN-ów warto wgrać do mojego sklepu o
   tematyce X?"), AI wybiera, wklejasz odpowiedź do `Bulk Mark ASINs`.
6. `WAAS → WooCommerce Export → Export Selected Products` — odpala się
   automatycznie + auto-resume.
7. Idziesz spać. Po kilku godzinach (zależnie od liczby produktów) wszystko jest
   w sklepie.

## Bezpieczeństwo / sanity checks per strona

Po pierwszym dużym eksporcie na nowej stronie:
1. **Sprawdź 3-5 losowych produktów** w WP admin → Products → Edit. Featured image
   + max 3 gallery thumbnails. Brak duplikatów wizualnych.
2. **W cloud logs Apps Script** poszukaj linii `Sent 4 images from fixed columns
   (Image0/1/4/7)` — to potwierdza że bierzemy z właściwych kolumn.
3. **Po stronie WP w error_log** powinno być `Regenerated X intermediate sizes
   for attachment #YYYY` — to potwierdza że miniaturki się generują.
4. **Jeśli widzisz duplikaty:** uruchom `WAAS → WooCommerce Export → Dedupe Media
   Library` (dry run najpierw). Wynik powinien być bliski zera; jeśli dużo
   duplikatów to znaczy że plugin nie jest aktualny — sprawdź Deactivate+Activate.

## Pliki referencyjne (zawsze z najnowszej wersji w gicie)

Branch: `claude/automate-keyword-copy-esrZ1`

```
google-apps-script/Menu.gs
google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs
google-apps-script/sp-api/SPApiKeywordBatch-WAAS.gs   ← nowy plik
wordpress-plugin/waas-product-manager/includes/class-rest-api-v2.php
```

Raw URLs:
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/Menu.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/ProductManager-WOOCOMMERCE-EXPORT.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/google-apps-script/sp-api/SPApiKeywordBatch-WAAS.gs
- https://raw.githubusercontent.com/LUKOAI/LUKO-WAAS/claude/automate-keyword-copy-esrZ1/wordpress-plugin/waas-product-manager/includes/class-rest-api-v2.php

## Co operator powinien wiedzieć na start dla każdej nowej strony

- Auto-resume cykl: ~6.5 min na cykl (5 min eksport + 30s+ jitter trigger delay).
- Średnio ~15s/produkt → 20-25 produktów per cykl.
- 1000 produktów to ~5-6 godzin auto-resume w tle.
- Apps Script daily quota: ~6h dla Google Workspace. Większy eksport idzie na
  dwa dni. Po quota exceeded, otwarcie arkusza pokazuje toast "X produktów
  pending, klik Resume Export Now" — operator klika raz, leci dalej.
- WordPress side: każdy upload zajmuje 3-8s (download + thumbnail regen).
  60s `set_time_limit` zapewnia że duże 2000×2000 obrazki nie urywają się
  cicho w środku regenerate.
