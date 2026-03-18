# WAAS — Claude Code Brief: Następne kroki po niche_replace

## KONTEKST — CO SIĘ UDAŁO

Step 4 (niche_replace) działa! 18819 zamian w 7 sekund na rasenkante-cortenstahl.lk24.shop.
Ale mechaniczny str_replace to dopiero fundament. Teraz trzeba:

---

## ZADANIE 1: AUTO-MENU (najważniejsze)

### Problem
Transition pomija menu (step 7: "No menu in Menu_CP — skip"). Menu powstaje ze starych pozycji + str_replace na nazwach, ale:
- Nie ma struktury parent→child
- Wszystkie pozycje są na jednym poziomie
- Brak logiki co jest podkategorią czego

### Rozwiązanie
Step 7 (deploy_menu) musi AUTOMATYCZNIE tworzyć menu na podstawie istniejących stron, BEZ potrzeby wypełniania Menu_CP ręcznie.

### Logika auto-menu:
Przeczytaj listę stron (GET /waas-pipeline/v1/get-site-structure) i przypisz je do struktury na podstawie TYPU strony:

```
MENU STRUCTURE TEMPLATE:
─────────────────────────
Start                          → homepage (page_on_front)
Blog                           → blog page (page_for_posts) LUB kategoria "Blog"
[Główna kategoria produktowa]  → strona z "Werkzeuge" / "Profi-" / "Installation" w tytule
  ├─ [Podkategoria 1]         → strony z category/technical w typie
  ├─ [Podkategoria 2]         → strony z Ratgeber/Anleitung w tytule
  └─ [Podkategoria 3]         → ...
Ratgeber                       → strona z "Ratgeber" w tytule
  ├─ [Poradnik 1]             → strony z how-to/anleitung tematyką
  ├─ [Poradnik 2]
  └─ ...
Markenprofil                   → strona "Markenprofil" (jeśli istnieje)
Shop                           → strona WooCommerce shop
```

### Reguły klasyfikacji stron do menu:
1. **Homepage** → zawsze "Start", zawsze pierwsza pozycja
2. **Blog** → strona typu "posts page" lub z "Blog"/"Ratgeber" w tytule → zawsze w menu głównym
3. **Shop** → strona WooCommerce → zawsze w menu głównym
4. **Legal pages** (Impressum, Datenschutz, Partnerhinweis, Warenkorb) → NIE w menu głównym (są w footer)
5. **Markenprofil** → w menu głównym jako osobny punkt
6. **Werkzeug/Profi/Installation strona** → menu główny, z podstronami jako children
7. **Pozostałe strony tematyczne** → podkategorie pod odpowiednim parent

### Heurystyka parent→child:
- Strona z NAJDŁUŻSZYM tytułem i najszerszą tematyką = parent
- Strony z węższą tematyką = children pod tym parent
- Użyj Claude AI (1 call) do klasyfikacji: podaj listę tytułów stron → AI zwraca JSON z hierarchią

### Przykładowy prompt do Claude AI (w step 7):
```
Masz listę stron WordPress. Stwórz logiczną strukturę menu nawigacyjnego.
Strony:
1. Premium Cortenstahl Rasenkanten (Homepage)
2. Profi-Werkzeuge für Cortenstahl-Rasenkanten Installation
3. Werkzeug Ratgeber für Cortenstahl-Rasenkanten
4. Cortenstahl-Rasenkanten Anleitungen & Projekte
5. Cortenstahl-Rasenkanten bei Amazon bestellen
6. Markenprofil
7. Shop
8. Impressum
9. Datenschutzerklärung
10. Amazon-Partnerhinweis
11. Warenkorb
12. Cortenstahl-Ratgeber (Blog)

Zwróć JSON:
[
  {"title": "Start", "page_id": 70, "children": []},
  {"title": "Blog", "page_id": 123, "children": []},
  {"title": "Werkzeug-Welt", "page_id": 31, "children": [
    {"title": "Werkzeug-Ratgeber", "page_id": 28},
    {"title": "Cortenstahl verlegen", "page_id": ...},
    ...
  ]},
  ...
]
Zasady: Homepage=Start, Legal pages (Impressum, Datenschutz, Partnerhinweis, Warenkorb) → NIE w menu.
Shop i Markenprofil = osobne punkty główne. Reszta = logiczna hierarchia.
```

### Implementacja:
- W `_tsExecuteStep()` step 7: zamiast czytać Menu_CP → wywołaj `_tsAutoMenu(state, wpUrl, auth)`
- `_tsAutoMenu()`:
  1. GET /waas-pipeline/v1/get-site-structure → lista stron z ID i tytułami
  2. Filtruj legal pages i warenkorb
  3. Wywołaj Claude AI z listą stron → dostaj JSON hierarchii
  4. POST /waas-pipeline/v1/set-menu z hierarchią (set-menu już obsługuje parent_id!)
- Fallback: jeśli Menu_CP ma wiersze dla tej domeny → użyj ich (jak teraz). Auto-menu tylko gdy brak w Menu_CP.

---

## ZADANIE 2: MARKENPROFIL — AI REWRITE

### Problem
str_replace zamienił "WERHE" na "Premium Cortenstahl" ale:
- Historia marki (WERonika + HElena, Koło Polska, F.H. GAJ) to WERHE, nie Cortenstahl
- "Premium Cortenstahl setzt sich aus den Anfangsbuchstaben der Vornamen der beiden Töchter" — bezsens
- Kontaktdane (tel, email, adres) są z WERHE
- Recenzje klientów mówią o "Estrich-Sanierung" i "Abbruchhammer" — to meisseltechnik

### Rozwiązanie
Po step 4 (niche_replace), dodaj step 4b: **AI Page Rewrite** — ALE TYLKO dla stron które tego wymagają.

Logika:
1. Lista stron do AI rewrite: `['markenprofil']` (hardcoded lub z konfiguracji)
2. Dla każdej takiej strony:
   - GET /waas-pipeline/v1/extract-texts/{id} → wyciągnij aktualne teksty
   - Wyślij do Claude z promptem: "Przepisz tę stronę Markenprofil dla marki [Niche Keyword]. Nie kopiuj historii innej marki. Napisz ogólny profil strony jako niezależnego portalu informacyjnego."
   - POST /waas-pipeline/v1/replace-texts z nowymi tekstami

Alternatywnie: stwórz szablon Markenprofil który jest generyczny:
- "O [Site Name]" zamiast historii konkretnej marki
- "[Site Name] jest niezależnym portalem informacyjnym..."
- Bez kontaktów producenta (to nie nasz producent)
- Z linkiem do Amazon zamiast kontaktu

### Kluczowe: 
Markenprofil powinien być o STRONIE (portal informacyjny), nie o PRODUCENCIE. Każda strona lk24.shop to niezależny portal — nie jest marką WERHE ani żadną inną.

---

## ZADANIE 3: CLEANUP STARYCH PRODUKTÓW

### Problem
Strony mają shortcode'y `[waas_product asin="B07YPSMWT5"]` — to stare ASINy z meisseltechnik. Wyświetlają "Product not found".

### Rozwiązanie
W step 3 (clean_remnants) lub step 4b:
1. Regex: znajdź `[waas_product asin="B0......."]` w post_content
2. Usuń te shortcode'y (zamień na pusty string)
3. Lub: zamień na placeholder `<!-- TODO: add product ASIN -->` do późniejszego uzupełnienia

Implementacja w PHP (waas-niche-replace.php lub waas-direct-publish.php cleanup):
```sql
UPDATE wp_posts 
SET post_content = REGEXP_REPLACE(post_content, '\\[waas_product[^\\]]*asin="[^"]*"[^\\]]*\\]', '')
WHERE post_content LIKE '%waas_product%' AND post_content LIKE '%Product not found%';
```

---

## ZADANIE 4: SEO META — AUTO-GENERATE

### Problem
Wszystkie strony mają Rank Math score 4/100 i generyczne keywords.

### Rozwiązanie
Po niche_replace, zaktualizuj Rank Math meta:
- `rank_math_title`: Tytuł strony + " | [Site Name]"
- `rank_math_description`: 150 znaków opis strony
- `rank_math_focus_keyword`: główny keyword z Niche Keyword (Sites sheet)

Można to zrobić:
- W step 4 (niche_replace) — str_replace już zamienił stare keywords
- Lub osobny krok: Claude AI generuje meta per strona

---

## ZADANIE 5: DISCLOSURE FIX

### Problem powtarzający się
Posty generowane przez Claude AI (step 5) zawierają "Als Amazon-Partner verdiene ich an qualifizierten Verkäufen" W TREŚCI posta. To ma być TYLKO w footer i na stronie /partnerhinweis/.

### Rozwiązanie
W `_tsCallClaude()` lub w system prompcie dla step 5:
Dodaj instrukcję: "NIGDY nie dodawaj Amazon disclosure/Partnerhinweis w treści artykułu. Disclosure jest automatycznie w footer strony."

---

## KOLEJNOŚĆ IMPLEMENTACJI

1. **Auto-menu** (step 7) — największy impact, widoczny od razu
2. **Markenprofil rewrite** (step 4b) — AI przepisanie markenprofil
3. **Cleanup starych produktów** — usunięcie broken shortcodes
4. **Disclosure fix** — zmiana promptu w step 5
5. **SEO meta** — opcjonalnie, mniejszy priorytet

---

## PLIKI DO ZMIANY

| Plik | Co zmienić |
|------|-----------|
| `ContentPipelineTransition.js` | `_tsAutoMenu()`, step 7 logika, step 4b AI rewrite |
| `ContentPipelineTransition.js` | Fix system prompt w `_tsCallClaude()` - no disclosure |
| `waas-niche-replace.php` | Dodać cleanup broken shortcodes (regex) |
| `Menu.js` | Ewentualnie nowe menu items |

---

## WAŻNE KONTEKSTY

- `set-menu` endpoint w waas-direct-publish.php JUŻ obsługuje `parent_id` w items
- `get-site-structure` endpoint JUŻ zwraca listę stron z ID i tytułami
- `_tsCallClaude()` JUŻ istnieje i działa (używany w step 5)
- Strony lk24.shop to NIEZALEŻNE portale informacyjne, NIE strony marek/producentów
- Disclosure TYLKO w footer (CSS `#footer-info::after`) i na `/partnerhinweis/`
- Auth: cookie+nonce przez `cpGetWPAuthForMedia()`
- Nowy endpoint niche_replace: `waas-niche/v1/replace` (nie `waas-pipeline/v1/cleanup`)

---

*Brief: 18.03.2026*
