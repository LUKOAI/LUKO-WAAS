# Sellers Capture & Enrichment — Setup Runbook

Krok po kroku do uruchomienia. Przy każdym kroku jest **kto co robi** (Ty vs Claude) i **kiedy** (przed/po dostępie do SA-key).

## Stan obecny

Branch `claude/amazon-seller-data-verification-EnYEl`:
- `seller-capture/chrome-extension/` — MV3 capture extension, gotowa do dev-load
- `seller-capture/apps-script/` — `Capture.gs`, `Worklist.gs`, `Actions.gs`, `LUKO_Client_Code_PATCH.gs`
- `seller-capture/bq/schema.sql` — DDL dla `luko_sellers` dataset
- `seller-capture/enrichment/` — Python worker + `migrate_legacy.py` + VIES source
- `seller-capture/data/agency_blacklist_seed.csv` — 44 znane agencje

## 0. SECURITY (zrób teraz, niezależnie od reszty)

### 0a. DKIM dla netanaliza.com (5 min)
1. Zaloguj się na admin.google.com jako luko@netanaliza.com
2. **Apps → Google Workspace → Gmail → Authenticate email**
3. Wybierz domenę `netanaliza.com` → **Generate new record**
4. Skopiuj wartość TXT (zaczyna się od `v=DKIM1; k=rsa; p=...`)
5. W DNS (NameCheap?) dodaj rekord:
   - Type: `TXT`
   - Host: `google._domainkey`
   - Value: wartość skopiowana w kroku 4
6. Wróć do Admin Console → **Start authentication**
7. Po 24h sprawdź `dig +short TXT google._domainkey.netanaliza.com`

### 0b. DMARC podnieś do quarantine (po 2 tygodniach DKIM bez błędów)
W DNS TXT rekord `_dmarc.netanaliza.com`:
```
v=DMARC1; p=quarantine; pct=25; rua=mailto:luko@netanaliza.com; ruf=mailto:luko@netanaliza.com; sp=quarantine; aspf=s; adkim=s
```

### 0c. LUKO_Client_Code anonymous fix
1. Otwórz skrypt w script.google.com (ID `1vHQjcih6xnM9UhLNJWfqCtaqUfenRsfAgfTP_NBEtXf-QfFRjzjPr0fb`)
2. Wygeneruj silny sekret: `openssl rand -hex 32`
3. **Project Settings → Script Properties → Add property**: `KARTRA_WEBHOOK_SECRET` = <ten sekret>
4. Wklej zawartość `apps-script/LUKO_Client_Code_PATCH.gs` jako nowy plik w projekcie
5. Zmień nazwę istniejącej funkcji `doPost` na `_originalDoPost_`
6. Dodaj nowy `doPost` jak w komentarzu pliku PATCH
7. W Kartra: edytuj outbound webhook → dodaj custom field `_secret` z tą samą wartością
8. **Deploy → Manage Deployments → New version** (nie nadpisuj — zachowaj poprzednią wersję jako rollback)
9. Test: spróbuj POST bez `_secret` — musi wrócić 401-style

## 1. Service-account JSON (Twoja akcja)

Skopiuj zawartość `~/Documents/luko-asin-report/amazonscrapingdata-key.json` lub
`~/Documents/luko-start-ASIN-zbieranie-danych/amazonscrapingdata-63a7923e1c96.json`
i wklej w czat (lub udostępnij przez sec-channel). Sprawdzę uprawnienia i ewentualnie poproszę o dodanie ról:
- `BigQuery Data Editor` na projekcie
- `BigQuery Job User` na projekcie
- `Storage Object Viewer` (jeśli będziemy używać GCS dla screenshotów zamiast Drive)

Klucz nigdy nie ląduje w repo. Po pracy obracamy go (delete + create new).

## 2. BigQuery dataset (Claude robi po §1)

```bash
gcloud config set project amazonscrapingdata
bq --location=EU mk --dataset --default_table_expiration=0 \
   --description="Luko sellers capture + enrichment + actions" \
   amazonscrapingdata:luko_sellers

# Apply schema
sed 's/${PROJECT}/amazonscrapingdata/g; s/${DATASET}/luko_sellers/g' \
   seller-capture/bq/schema.sql > /tmp/schema_final.sql
bq query --use_legacy_sql=false < /tmp/schema_final.sql

# Seed agency blacklist
bq load --autodetect --source_format=CSV --skip_leading_rows=1 \
   amazonscrapingdata:luko_sellers.agency_blacklist \
   seller-capture/data/agency_blacklist_seed.csv
```

## 3. Nowy arkusz "Sellers Worklist" (Claude tworzy, Ty kopiujesz link)

1. Tworzę nowy spreadsheet `Sellers Worklist` na Twoim koncie (przez Drive API z SA, dam Ci później ownership).
2. Wklejam zawartość `apps-script/Capture.gs`, `Worklist.gs`, `Actions.gs` przez clasp / Apps Script API.
3. Włączam BigQuery Advanced Service w projekcie GAS.
4. Ustawiam Script Properties:
   - `BQ_PROJECT_ID = amazonscrapingdata`
   - `BQ_DATASET = luko_sellers`
   - `CAPTURE_SHEET_ID = <id tego arkusza>`
   - `CAPTURE_SHARED_SECRET = <openssl rand -hex 32>`
   - `KARTRA_WEBHOOK_URL = <Twój Kartra inbound webhook>`
   - `ENRICH_QUEUE_URL = <Cloud Run URL, krok §5>`
   - `ENRICH_SHARED_SECRET = <kolejny openssl rand>`
   - `ACTION_BLAND_URL = <Bland webhook>`  (z `b2b-saas/sales-funnel/ai-calling/bland_caller.py`)
   - `ACTION_VAPI_URL = <Vapi webhook>`
   - `SITEPATRON_SYNC_SHEET = <ID LUKO_Domain_Slug_Finder>`
5. Deploy doPost jako Web App: **Execute as = me, Access = Anyone with the link**
   (auth jest na HMAC, nie na Google identity — Anyone-with-link to standard MV3 endpoint).

## 4. Chrome extension (Twój operator instaluje lokalnie)

1. W GCP Console (`amazonscrapingdata`): **APIs & Services → Credentials → Create OAuth client ID → Chrome App**.
2. Wklej Application ID extension'a (pobierzesz po pierwszym zaladowaniu w trybie dev).
3. Skopiuj `client_id` → `chrome-extension/manifest.json` w polu `oauth2.client_id`.
4. W Chrome: `chrome://extensions/` → Developer mode → **Load unpacked** → wskaż `seller-capture/chrome-extension/`.
5. Kliknij ikonę → popup → wpisz:
   - Endpoint = Web App URL z §3.5
   - Drive folder ID = nowy folder "Amazon Seller Captures" (utwórz w Drive)
   - Operator ID = inicjały operatora (np. `op_anna`)
   - Shared secret = wartość `CAPTURE_SHARED_SECRET` z §3.4
   - Language = EN albo PL
6. Otwórz dowolną stronę sprzedawcy Amazon (np. `amazon.de/sp?seller=A2NADM5YLG2DXW`) → Alt+S → toast.

## 5. Enrichment worker (Cloud Run, Claude pisze, deploy razem)

Po §1-3:
- Wystawiam `seller-capture/enrichment/` jako Cloud Run service z HMAC auth.
- Cron: co 5 min `python -m enrichment.main pending --limit 100`.
- Per-seller: ~5-15 s, koszt ~$0.003 (LLM Haiku).

## 6. Backfill 100k legacy (jednorazowo)

Po §3 (mam dostęp do SA + dataset istnieje):
1. Uzupełniam `LEGACY_SOURCES` w `migrate_legacy.py` realnymi `sheet_id` (z audytu — `WYSYLANIE EMAIL GPSR`, `AmazonSellersForSearchOnLinkedin` itd.).
2. Udzielasz service account viewer-permission do tych arkuszy (Share → SA email).
3. `python -m enrichment.migrate_legacy --source all --dry-run` → sprawdzam liczby.
4. `python -m enrichment.migrate_legacy --source all` → wgrywam.
5. Patrzymy w BQ: ile sellerów z emailem, ile z telefonem, ile flagged-customer.

## 7. Pierwszy test end-to-end

1. Operator otwiera 5 stron sellerów → Alt+S na każdej.
2. Sprawdzamy `Capture inbox` tab — 5 wierszy.
3. Sprawdzamy BQ: `SELECT * FROM sellers_enriched WHERE last_captured_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 10 MINUTE)`.
4. Odpalamy enrichment worker manualnie: `python -m enrichment.main pending --limit 5`.
5. W arkuszu **Refresh Worklist** — pojawiają się te 5 z confidence + decision-maker.
6. Zaznaczamy 1 wiersz → dropdown `Send email — intro EN` → menu `▶️ Run selected actions`.
7. Sprawdzamy: email poszedł z Gmail, wiersz w `action_log`, kolumny `last_action_*` zaktualizowane.

## Rollback plan

Każdy krok jest niezależny:
- Extension: wyłącz w `chrome://extensions/`.
- Web App: w Manage Deployments wróć do poprzedniej wersji.
- BQ: dataset jest separate, drop bez wpływu na nic innego.
- Migration: `sellers_enriched` ma `legacy_source` — można wyfiltrować i usunąć.
