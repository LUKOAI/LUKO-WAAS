# LUKO Domain Slug Finder

Automatyczne znajdowanie optymalnych nazw poddomeny dla niszowych stron afiliacyjnych Amazon.de.

## Stack

- Google Sheets — UI + baza danych
- Google Apps Script — caly backend
- Amazon SP API (Catalog Items, LWA auth)
- Anthropic Claude API (claude-sonnet-4-20250514)
- Amazon DE Autocomplete
- Google DE Autocomplete
- DENIC RDAP (informacyjnie)

## Instalacja

### Krok 1: Stworz Google Sheet

1. Utworz nowy Google Sheet
2. Otworz Apps Script Editor: **Extensions > Apps Script**
3. Usun domyslny `Code.gs`
4. Stworz nowy plik `DomainSlugFinder.gs`
5. Wklej cala zawartosc pliku `DomainSlugFinder.gs` z tego katalogu

### Krok 2: Zainstaluj menu

1. W edytorze Apps Script uruchom funkcje `onOpen()` raz (przycisk Run)
2. Wroc do Google Sheets — w pasku menu pojawi sie **Domain Finder**

### Krok 3: Konfiguruj API Keys

1. **Domain Finder > Konfiguruj API Keys**
2. Wpisz kolejno:
   - `CLAUDE_API_KEY` — z [console.anthropic.com](https://console.anthropic.com) > API Keys
   - `SP_LWA_CLIENT_ID` — z Amazon Seller Central > Apps & Services > Develop Apps
   - `SP_LWA_CLIENT_SECRET` — Secret z tej samej aplikacji LWA
   - `SP_REFRESH_TOKEN` — Token z procesu autoryzacji SP-API
   - `SP_SELLER_ID` — Twoj Amazon Seller ID

### Krok 4: Zainstaluj trigger

1. **Domain Finder > Zainstaluj trigger**
2. Potwierdz instalacje — system utworzy zakladki INPUT, ANALYSIS, SLUGS, ASINS

### Krok 5: Test

1. **Domain Finder > Test z ASIN B0FRG79LF9**
2. Poczekaj 20-35 sekund
3. Sprawdz zakladki SLUGS i ANALYSIS

### Krok 6: Normalna praca

1. Przejdz do zakladki **INPUT**
2. Wpisz w kolumnie A: `ASIN` lub `KEYWORD`
3. Wpisz w kolumnie B: numer ASIN lub fraze po niemiecku
4. Zaznacz checkbox w kolumnie F
5. System automatycznie przetworzy wiersz

## Zakladki Google Sheets

### INPUT
| Kolumna | Opis |
|---------|------|
| A: Typ | ASIN lub KEYWORD |
| B: Wartosc | ASIN produktu lub fraza DE |
| C: Rynek | Domyslnie: DE |
| D: Root Domain | Domyslnie: lk24.shop |
| E: Status | PENDING / PROCESSING / DONE / ERROR |
| F: Trigger | Checkbox — zaznaczenie uruchamia pipeline |
| G: Timestamp zlecenia | Auto |
| H: Timestamp ukonczenia | Auto |
| I: Top Slug | Najlepszy slug |
| J: Score | Wynik 0-7 |
| K: Error | Komunikat bledu |

### ANALYSIS
Zawiera pelna analize niszowa z 13 polami (needs_and_problems, buyer_personas, frequent_words, itd.)

### SLUGS
Zawiera 5-8 propozycji slugow z ocenami, uzasadnieniami DE/PL, statusem domeny .de

### ASINS
Zawiera dodatkowe ASINy pasujace do najlepszego sluga — gotowe do importu na strone

## Koszt jednej analizy

| Skladnik | Koszt |
|----------|-------|
| Claude API (~5000 tokenow) | ~$0.008 |
| SP API | $0 |
| Autocomplete | $0 |
| DENIC | $0 |
| **TOTAL** | **~$0.008** |

100 analiz miesiecznie = ~$0.80

## Czas przetwarzania

Typowy pipeline: 20-35 sekund na jeden ASIN/keyword.

## Testowy ASIN

- **ASIN**: B0FRG79LF9
- **Produkt**: WERHE Stichsaegeblaetter T119A HCS
- **Oczekiwany top slug**: `stichsaegeblaetter` (CATEGORY_BASED, score 7/7)

## Troubleshooting

- **SP-API Error**: Sprawdz klucze w Domain Finder > Konfiguruj API Keys
- **Claude Error**: Sprawdz CLAUDE_API_KEY i limity na console.anthropic.com
- **TIMEOUT**: Pipeline zmiesci sie w 6-minutowym limicie Apps Script (typowo 20-35s)
- **Trigger nie dziala**: Uruchom ponownie Domain Finder > Zainstaluj trigger

## Wersja

- v2.0 — LUKO Domain Slug Finder
- Autor: NetAnaliza / LUKO (Lukasz Koronczok)
