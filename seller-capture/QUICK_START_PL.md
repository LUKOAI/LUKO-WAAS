# Weryfikacja sprzedawców Amazon — instrukcja krok po kroku

## Co to robi

Bierzesz plik CSV z listą sprzedawców Amazon (taką jak masz teraz z scrapowania). Narzędzie:

1. Pomija **polskich** i **niemieckich** sprzedawców (zapisuje ich do CSV-out, ale nie sprawdza dalej — DE/PL są poza naszym targetem outreach).
2. Dla **zagranicznych** (UK, FR, IT, ES, NL, CN, US, …) sprawdza:
   - Czy firma istnieje i jest aktywna (oficjalne rejestry)
   - Kto jest decydentem (imię, rola, email, telefon)
   - Czy to nie jest **agencja reprezentująca** sprzedawcę (GPSR rep, fiscal rep, EPR rep) — wtedy flaguje i pomija
   - Czy sprzedaje na amazon.de (VAT-DE, WEEE, LUCID, FBA)
3. Daje Ci CSV z wynikami: kogo kontaktować, w jakiej kolejności, z jaką pewnością.

## Co musisz mieć

- **Komputer** z systemem Mac, Linux lub Windows
- **Python 3.11 albo nowszy** (sprawdzimy w kroku 1)
- **Internet**
- **CSV ze sprzedawcami** — twoje obecne dane

To wszystko. Bez żadnego Google Cloud, BigQuery, BQ migration, etc.

---

## Krok 1 — Sprawdź czy masz Pythona

Otwórz Terminal:
- **Mac**: naciśnij `⌘ + Spacja`, wpisz `Terminal`, Enter
- **Linux**: `Ctrl + Alt + T`
- **Windows**: naciśnij klawisz `Windows`, wpisz `PowerShell`, Enter

W terminalu wpisz:
```bash
python3 --version
```

Powinieneś zobaczyć coś takiego: `Python 3.11.x` albo wyżej.

**Jeśli pojawi się błąd "command not found":**
- Mac: zainstaluj z https://www.python.org/downloads/macos/ (klik "Download Python 3.x")
- Windows: zainstaluj z https://www.python.org/downloads/windows/ — **WAŻNE**: w kreatorze instalacji zaznacz checkbox **"Add Python to PATH"**
- Linux: `sudo apt install python3 python3-pip`

Po instalacji ponownie wpisz `python3 --version` żeby się upewnić że działa.

---

## Krok 2 — Pobierz projekt na swój komputer

Jeśli masz już sklonowane repo `LUKO-WAAS` — pomiń ten krok i przejdź do kroku 3.

Jeśli nie:
```bash
cd ~/Documents
git clone https://github.com/lukoai/luko-waas.git
cd luko-waas
```

Nie masz `git`? Pobierz ZIP-a:
1. Idź na https://github.com/lukoai/luko-waas (jeśli ten repo jest prywatny — wejdź zalogowany)
2. Klik zielony **Code** → **Download ZIP**
3. Rozpakuj. Wejdź do folderu w terminalu: `cd ~/Downloads/luko-waas-main`

---

## Krok 3 — Przełącz się na właściwą gałąź

```bash
git checkout claude/amazon-seller-data-verification-EnYEl
```

Powinieneś zobaczyć: `Switched to branch 'claude/amazon-seller-data-verification-EnYEl'`.

Jeśli ZIP-a pobrałeś, gałąź jest już dobra — pomiń.

---

## Krok 4 — Wejdź do katalogu enrichment i zainstaluj zależności

```bash
cd seller-capture/enrichment
pip3 install -r requirements.txt
```

To pobierze biblioteki potrzebne narzędziu (kilkadziesiąt sekund). Na końcu zobaczysz "Successfully installed …".

**Jeśli pojawi się błąd "externally-managed-environment"** (Mac/Linux): dodaj `--break-system-packages` na końcu, czyli:
```bash
pip3 install -r requirements.txt --break-system-packages
```

---

## Krok 5 — Przygotuj swój CSV ze sprzedawcami

Twój CSV musi mieć **przynajmniej kolumnę `seller_id`**. Im więcej kolumn, tym lepsze wyniki. Pełna lista kolumn (możesz mieć tylko niektóre):

| Kolumna | Co zawiera | Przykład |
|---|---|---|
| `seller_id` | identyfikator sprzedawcy (dowolny string, byle unikalny) | `A2NADM5YLG2DXW` |
| `country` | kraj (pełna nazwa albo kod 2-literowy) | `Germany` lub `DE` |
| `vat` | NIP z prefiksem kraju | `DE123456789` |
| `business_name` | nazwa firmy z Amazona | `Müller Handels GmbH` |
| `business_address` | adres z Amazona | `Hauptstr 10, 80331 München` |
| `registry_id` | numer w rejestrze (UK Companies number, FR SIREN) | `12345678` |
| `phone_raw` | telefon z Amazona | `+49301234567` |
| `email_raw` | email z Amazona | `seller@example.com` |
| `raw_text` | **dowolny inny tekst** zescrapowany ze strony — to często najcenniejsze (URLs, GPSR text, WEEE numery) | `Visit https://acme.de — WEEE-Reg.-Nr. DE 12345678` |

**Przykład pliku CSV** masz w `enrichment/examples/sample_sellers.csv` — możesz go otworzyć w Excelu albo Numbersie żeby zobaczyć strukturę.

Twój CSV zapisz np. jako `~/Documents/moi_sprzedawcy.csv`.

> ⚠️ **Format CSV**: Excel/Numbers domyślnie zapisuje z separatorem `;` w wersjach europejskich. Upewnij się że masz separator `,` (przecinek). W Excelu: **Plik → Zapisz jako → CSV UTF-8 (z separatorem przecinkowym)**.

---

## Krok 6 — Uruchom weryfikację (najprostsza wersja)

W terminalu (nadal w `seller-capture/enrichment`):

```bash
python3 -m enrichment.local_run ~/Documents/moi_sprzedawcy.csv ~/Documents/wynik.csv --limit 5
```

`--limit 5` znaczy "weź pierwszych 5 wierszy, nie całość". Tak najpierw przetestujesz na małej próbce.

Zobaczysz w terminalu logi typu:
```
ANTHROPIC_API_KEY not set — LLM merge step will be skipped
COMPANIES_HOUSE_API_KEY not set — UK Companies House skipped
...
TEST_UK_1 -> status=enriched_failed segment=foreign priority=review
TEST_DE_1 -> status=skipped_de segment=DE priority=inactive
TEST_PL_1 -> status=skipped_pl segment=PL priority=skip
done. processed=5 errors=0
```

Otwórz `~/Documents/wynik.csv` w Excelu/Numbersie — zobaczysz wszystkie kolumny z wynikami.

**Bez kluczy API to wciąż działa, ale z ograniczonymi możliwościami** — narzędzie:
- ✅ Klasyfikuje sprzedawców DE/PL/foreign poprawnie
- ✅ Wyciąga WEEE/LUCID/FBA signals z `raw_text`
- ✅ Sprawdza VIES (oficjalny rejestr VAT UE) — *publiczny, bez klucza*
- ✅ Próbuje pobrać impressum z firmowej strony — *publiczny, bez klucza*
- ❌ Nie używa Companies House (UK) — wymaga klucza
- ❌ Nie używa Pappers (FR) — wymaga klucza
- ❌ Nie używa LLM merge (najmocniejszy krok) — wymaga klucza Anthropic

---

## Krok 7 (opcjonalny ale **mocno polecane**) — Dodaj klucze API

Najlepszy efekt dostaniesz z kluczem **Anthropic** (LLM merge — to ten krok który czyta wszystkie sygnały razem i daje finalną decyzję). Wszystkie klucze są **darmowe** w wersji startowej.

### A. Klucz Anthropic (LLM merge — najważniejszy)

1. Wejdź na https://console.anthropic.com/
2. Załóż konto (albo zaloguj się — pewnie masz)
3. Lewa nawigacja → **API Keys** → **Create Key**
4. Skopiuj klucz (zaczyna się od `sk-ant-...`)

W terminalu (Mac/Linux):
```bash
export ANTHROPIC_API_KEY="sk-ant-twój-klucz-tutaj"
```

Windows PowerShell:
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-twój-klucz-tutaj"
```

> Klucz trzeba ustawić **w tym samym oknie terminala** w którym będziesz uruchamiać. Jeśli zamkniesz terminal, trzeba ustawić ponownie. (Pokażę później jak zapisać na stałe.)

### B. Klucz Companies House (UK firms — darmowy, instant)

1. https://developer.company-information.service.gov.uk/
2. Zarejestruj się (Sign In → Register)
3. Po zalogowaniu: **Your applications** → **Create an application** → wybierz "Live"
4. Skopiuj klucz

```bash
export COMPANIES_HOUSE_API_KEY="twój-klucz"
```

### C. Klucz Pappers (FR firms — darmowy plan 100/dzień)

1. https://www.pappers.fr/api → kliknij **S'inscrire**
2. Załóż konto, plan **Gratuit**
3. **Mes API tokens** → skopiuj `api_token`

```bash
export PAPPERS_API_KEY="twój-klucz"
```

### D. Google CSE (wyszukiwarka firm — darmowy 100/dzień)

To trochę bardziej zaangażowane:
1. https://programmablesearchengine.google.com/ → utwórz nową wyszukiwarkę:
   - "Search the entire web"
   - Nazwij `luko-seller-finder`
2. Po utworzeniu klik **Setup** → skopiuj **Search engine ID**
3. https://console.cloud.google.com/apis/credentials → **Create Credentials** → **API key**
4. Skopiuj klucz

```bash
export GOOGLE_CSE_KEY="twój-klucz"
export GOOGLE_CSE_ID="twój-search-engine-id"
```

Jeśli któryś z kluczy Ci nie wyjdzie — nie szkodzi. Pipeline pomija po cichu i działa dalej z tym co ma.

---

## Krok 8 — Uruchom z kluczami na całości

```bash
python3 -m enrichment.local_run ~/Documents/moi_sprzedawcy.csv ~/Documents/wynik.csv
```

(Bez `--limit` = wszystkie wiersze.)

Czas: **~5-15 sekund na sprzedawcę** (zależy od ilości wywołań sieciowych). 1000 sprzedawców = 1.5-4 godziny.

Koszt LLM (Claude Haiku 4.5): ~$0.001-0.003 za sprzedawcę. 1000 sprzedawców = $1-3.

---

## Krok 9 — Co dostaniesz w `wynik.csv`

Najważniejsze kolumny do analizy:

| Kolumna | Co znaczy |
|---|---|
| `outreach_priority` | **`high`** = top target (foreign + signals DE) **·** **`medium`** = foreign bez signals **·** **`review`** = manual qualification **·** **`inactive`** = DE-resident **·** **`skip`** = PL lub agencja |
| `jurisdiction_segment` | `foreign` / `DE` / `PL` / `unknown` |
| `agency_flag` | jeśli niepusty = to agencja (GPSR rep, fiscal rep itp.) — **nie kontaktuj** |
| `decision_maker_name` | imię i nazwisko decydenta (np. "Max Mustermann") |
| `decision_maker_role` | rola (Geschäftsführer, Director, Président, ...) |
| `email` | email do kontaktu — preferowany jest *personalny* (np. max.m@firma.de), nie generyczny (info@) |
| `phone` | telefon w formacie E.164 |
| `confidence_overall` | 0-100, jak pewny tej wskazówki |
| `notes_json` | uwagi operatorskie od LLM (np. *"Email matches Pappers Président"*) |

Filtruj w Excelu:
- `outreach_priority = high` → priorytet
- `agency_flag` puste **AND** `email` niepuste → gotowe do outreach
- `outreach_priority = review` → jeszcze niepewne, manualnie sprawdź

---

## Częste problemy

**"ModuleNotFoundError: No module named 'enrichment'"** → uruchamiasz z złego katalogu. Wejdź do `seller-capture/enrichment` (`cd seller-capture/enrichment`) i odpalaj `python3 -m enrichment.local_run ...`.

**"Permission denied"** → spróbuj z `python3` zamiast `python`, albo `pip3 install --user ...`.

**Działa wolno** → to normalne. Każdy sprzedawca = kilka wywołań sieciowych + 1 wywołanie LLM. Dodaj `--limit 10` na pierwszej próbie żeby zobaczyć że działa, potem puść całość zostawiając komputer.

**Excel pokazuje krzaczki w polskich/niemieckich nazwiskach** → Excel źle czyta UTF-8. Otwórz CSV w **Numbers** (Mac) albo **LibreOffice Calc** (free, https://www.libreoffice.org/) — te radzą sobie poprawnie.

---

## Co dalej

Jak zobaczysz że narzędzie działa na próbce 5-10 sprzedawców i wyniki są sensowne, daj znać — wtedy:
1. Przepuścimy na pełnej bazie
2. Zaplanujemy outreach: kto, jakim mailem, w jakiej kolejności
3. Ewentualnie zautomatyzujemy wysyłkę (Kartra/Bland/Vapi — masz już infrastrukturę z innego projektu LUKO)
