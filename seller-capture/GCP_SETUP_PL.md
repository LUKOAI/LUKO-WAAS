# GCP Setup — pełna konfiguracja produkcyjna (PL)

Przewodnik krok po kroku przez konfigurację Google Cloud dla seller-capture (BigQuery + Cloud Run + service account). To jest **alternatywa** dla `SETUP.md`, który zakłada używanie istniejącego projektu `amazonscrapingdata`. Tutaj zakładamy **świeży, dedykowany projekt** `luko-sellers`.

## Decyzje architekturalne

Skala: **1-4 operatorów**, najczęściej 1. ~100 captures/dzień.

- **Nowy projekt GCP** (czysto, bez bagażu starego `amazonscrapingdata`)
- **BigQuery** jako baza (cały kod już pod to napisany — schema, Apps Script, enrichment worker). Przy tej skali mieścimy się w darmowym tier (10 GB storage + 1 TB query/miesiąc)
- **Apps Script + Google Sheet** = interfejs operatora (Worklist). Działa od ręki bez instalowania niczego
- **Chrome Extension** (MV3, już napisana — tylko load unpacked)
- **Cloud Run** dla enrichment worker. Cron co 5 min. Darmowy tier
- **Koszt miesięczny**: ~$2-5 (głównie Claude API za LLM merge)

## Status

- [x] **Krok 1** — projekt GCP `luko-sellers` utworzony (project number `697599784684`)
- [x] **Krok 2** — BigQuery API enabled, billing `luko-amazon-content-manager` linked
- [x] **Krok 3** — service account `luko-sellers-worker` + JSON key w `~/.config/luko-sellers/key.json` (Windows: `C:\Users\user\.config\luko-sellers\key.json`)
- [x] **Krok 4** — dataset `luko_sellers` + 4 tabele + 3 widoki + 44 agencji w blacklist (via Cloud Shell)
- [x] **Krok 4.5** — end-to-end validation OK (6 testowych sprzedawców, agency detection na TEST_CN_1 zadziałała, prompt caching aktywne, koszt ~$0.004)
- [x] **Krok 6** — Apps Script + Sheet "Sellers Worklist" + Chrome extension OK. Pierwsza prawdziwa captura: A3O1SPPVFKO786 (Gusti Leder) + A1K54PLD9Q8BM9 (Bugelo Trading) zapisane do Sheet + BQ via HMAC-signed POST.
- [ ] **Krok 5** — Cloud Run enrichment worker (sensowne gdy juz mamy ciagly ruch capturow; do tego czasu `python -m enrichment.main pending` z Cloud Shell wystarcza)
- [ ] **Krok 7** — backfill legacy danych z istniejacych arkuszy

> **Lesson learned z Kroku 4**: lokalny `bq` z gcloud SDK 519 na Windows ma bug w bundled Python (`absl.flags has no attribute 'FLAGS'`). `gcloud components update` wymaga Admin (gcloud zainstalowane w `Program Files (x86)`). `curl` na Windows blokuje pobieranie po HTTPS przez cert revocation check (`CRYPT_E_NO_REVOCATION_CHECK`). **Wniosek**: dla operacji BQ/gcloud na Windows używaj **Cloud Shell** (browser-based, działa od ręki). Lokalny gcloud da się naprawić tylko reinstalacją jako User zamiast Admin, ale w dalszych krokach tego nie potrzebujemy.

> **Lesson learned z Kroku 6**: (1) `Utilities.computeHmacSha256Signature(value, key)` 2-arg NIE używa UTF-8 mimo deklaracji w docs — dla non-ASCII chars (German ß, umlauty) wynik się rozjeżdża z web crypto. **Fix**: zawsze 3-arg z explicit `Utilities.Charset.UTF_8`. (2) Apps Script Web App z `Content-Type: application/json` triggeruje CORS preflight (OPTIONS), którego nie obsługuje — używać `text/plain;charset=utf-8`. (3) Manifest Chrome extension wymaga `script.google.com` i `script.googleusercontent.com` w `host_permissions`. (4) Po reload extension, content script na istniejących kartach umiera — wymaga F5 na stronie Amazon przed pierwszym Alt+S.

---

## Krok 1 — Projekt GCP (DONE)

Utworzony przez UI Console:
- Project name: `luko-sellers`
- Project ID: `luko-sellers`
- Project number: `697599784684`
- Organizacja: `netanaliza.com`

---

## Krok 2 — BigQuery API + Billing (5-10 min)

### 2A. Włącz BigQuery API

1. Upewnij się że masz wybrany projekt `luko-sellers` (dropdown obok "Google Cloud" u góry)
2. W pasku wyszukiwania u góry wpisz: `BigQuery API`
3. Kliknij wynik **BigQuery API** ("A data platform for customers to create, manage, share and query data")
4. Klik **ENABLE**, czekaj 10-30 s
5. **Sprawdzenie**: hamburger (≡) → **BigQuery** → otworzy się SQL workspace z `luko-sellers` w drzewie po lewej

### 2B. Billing

Cloud Run i BigQuery wymagają linkowanego billing account — nawet w darmowym tier.

1. Hamburger → **Billing**
2. Dwa scenariusze:

**A. Masz już billing account (np. dla `amazonscrapingdata`):**
- "This project has no billing account" → **LINK A BILLING ACCOUNT**
- Wybierz istniejące konto → **SET ACCOUNT**

**B. Pierwszy raz (brak billing account):**
- **CREATE ACCOUNT**
- Kraj: **Poland**
- Typ konta: **Business** (jeśli LUKO to firma) / **Individual**
- Adres + NIP (PL...)
- Karta kredytowa — wymagana, ale nie obciążą jeśli nie przekroczysz darmowego tier
- Po stworzeniu → wróć do Billing w projekcie → **LINK A BILLING ACCOUNT**

### 2C. Sprawdzenie

W Billing w projekcie powinno być:
- Billing account: nazwa + ID typu `01ABCD-234567-8EFGHI`
- "Current month costs: $0.00"

---

## Krok 3 — Service Account + JSON key (5-10 min)

Service account będzie używany przez:
- enrichment worker (Cloud Run) do BigQuery
- Apps Script do BigQuery (przez Advanced Service)
- migracje legacy z istniejących arkuszy

### 3A. Utworzenie service accounta

1. Hamburger → **IAM & Admin** → **Service Accounts**
2. Klik **+ CREATE SERVICE ACCOUNT** (góra)
3. Wypełnij:
   - Service account name: `luko-sellers-worker`
   - Service account ID: zostaw auto (`luko-sellers-worker`)
   - Description: `BigQuery + Cloud Run worker for seller enrichment`
4. Klik **CREATE AND CONTINUE**
5. **Grant access** — dodaj role (po kolei, użyj wyszukiwania w polu):
   - `BigQuery Data Editor`
   - `BigQuery Job User`
   - `Storage Object Viewer` (na razie nie obowiązkowe, ale na zapas dla GCS)
6. Klik **CONTINUE** → **DONE**

### 3B. JSON key

1. W liście Service Accounts kliknij na nowo utworzony `luko-sellers-worker@luko-sellers.iam.gserviceaccount.com`
2. Zakładka **KEYS** (na górze)
3. **ADD KEY** → **Create new key** → typ **JSON** → **CREATE**
4. Plik JSON pobierze się automatycznie (np. `luko-sellers-xxxxxx.json`)
5. **Zapisz w bezpiecznym miejscu** (np. `~/Documents/luko-sellers-key.json`)
6. **Nigdy nie commituj do repo!** (`.gitignore` ma `*.json` w `seller-capture/`)

---

## Krok 4 — Dataset + schema + agency seed (5 min)

Tutaj wykonujemy komendy z lokalnego terminala. Wymagany `gcloud` CLI + `bq` (instalacja: https://cloud.google.com/sdk/docs/install).

### 4A. Auth + project

```bash
gcloud auth login                           # otworzy przeglądarkę
gcloud config set project luko-sellers
gcloud auth application-default login       # dla bibliotek Python
```

### 4B. Utworzenie datasetu

```bash
bq --location=EU mk --dataset \
   --default_table_expiration=0 \
   --description="Luko sellers capture + enrichment + actions" \
   luko-sellers:luko_sellers
```

### 4C. Apply schema

Z katalogu repo (`cd ~/path/to/luko-waas`):

```bash
sed 's/${PROJECT}/luko-sellers/g; s/${DATASET}/luko_sellers/g' \
   seller-capture/bq/schema.sql > /tmp/schema_final.sql
bq query --use_legacy_sql=false < /tmp/schema_final.sql
```

Sprawdzenie: w Console → BigQuery → drzewo `luko-sellers` → `luko_sellers` powinien zawierać tabele: `sellers_raw`, `sellers_enriched`, `agency_blacklist`, `action_log` (lub jakie tam zdefiniowane w schema.sql).

### 4D. Seed agency blacklist

```bash
bq load --autodetect --source_format=CSV --skip_leading_rows=1 \
   luko-sellers:luko_sellers.agency_blacklist \
   seller-capture/data/agency_blacklist_seed.csv
```

44 wierszy załadowanych. Sprawdź:

```bash
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) AS n FROM \`luko-sellers.luko_sellers.agency_blacklist\`"
```

---

## Krok 5 — Enrichment worker (Cloud Run)

(do opracowania szczegółowo w momencie kiedy do tego dojdziemy — wymaga deploya kontenera, konfiguracji secret managera dla kluczy API, cron job)

Wstępny szkic:
1. Build kontenera z `seller-capture/enrichment/` (Dockerfile do utworzenia)
2. Push do Artifact Registry w `luko-sellers`
3. Deploy Cloud Run service z env vars (BQ_PROJECT, BQ_DATASET, ANTHROPIC_API_KEY z Secret Manager, COMPANIES_HOUSE_API_KEY, PAPPERS_API_KEY)
4. Cloud Scheduler cron `*/5 * * * *` → HTTP POST do Cloud Run z HMAC

---

## Krok 6 — Apps Script + Sheet + Chrome extension

(do opracowania)

1. Tworzy się arkusz `Sellers Worklist` (możemy zrobić to przez Drive API z SA)
2. Bound Apps Script project, wklejka `Capture.gs` / `Worklist.gs` / `Actions.gs`
3. Script Properties: `BQ_PROJECT_ID=luko-sellers`, `BQ_DATASET=luko_sellers`, secrety
4. Deploy doPost jako Web App
5. Chrome extension: OAuth client ID → wklejka do `manifest.json` → load unpacked

---

## Krok 7 — Backfill legacy

(do opracowania)

`enrichment/migrate_legacy.py` z listą `LEGACY_SOURCES` (sheet_id istniejących arkuszy: `WYSYLANIE EMAIL GPSR`, `AmazonSellersForSearchOnLinkedin`, itd.). Wymaga że dasz SA viewer-permission do tych arkuszy.

---

## Notatki / problemy znane

- **Poprzednia sesja Claude crashowała** na `API Error 400: cache_control cannot be set for empty text blocks` — był to problem z prompt cachingiem przy długich konwersacjach. Stąd ten plik — żeby nawet jak sesja padnie znowu, plan był zapisany.
- **`SETUP.md` w tym samym katalogu** używa starego projektu `amazonscrapingdata`. Ten plik (`GCP_SETUP_PL.md`) jest świeższą, czystszą wersją dla nowego projektu `luko-sellers`. Jeśli dojdziemy do produkcji, można `SETUP.md` zaktualizować lub usunąć.
