# DEPLOY_CHECKLIST.md — Cloud Run produkcja, po polsku

Checklist deploy enrichment workera na Google Cloud (projekt `luko-sellers`).
**Niczego tutaj nie wykonujesz przez Claude** — kopiujesz komendy ręcznie po
przejrzeniu, w terminalu z aktywnym `gcloud auth login`.

Wymagane przed startem:
- GCP setup wg `GCP_SETUP_PL.md` (Kroki 1-4) **DONE**
- Branch `claude/amazon-seller-data-verification-EnYEl` zmergowany do `main`
  (albo deploy z feature brancha — patrz sekcja Decyzje)

---

## 1. Pre-deploy — secrety i IAM (15 min)

### 1A. Secret Manager — 3 klucze (BRAVE / CH / ANTHROPIC)

Klucze NIGDY nie idą do gita ani env-vars commitowanego YAML. Secret Manager
jest source of truth — Cloud Run service ma uprawnienie `secretAccessor`
i pulluje z Secret Managera w czasie cold-start.

```bash
gcloud config set project luko-sellers

# włącz Secret Manager API
gcloud services enable secretmanager.googleapis.com

# utwórz po jednym sekrecie na klucz (replication: automatic)
printf '%s' "$BRAVE_API_KEY"            | gcloud secrets create brave-api-key            --data-file=- --replication-policy=automatic
printf '%s' "$COMPANIES_HOUSE_API_KEY"  | gcloud secrets create companies-house-api-key  --data-file=- --replication-policy=automatic
printf '%s' "$ANTHROPIC_API_KEY"        | gcloud secrets create anthropic-api-key        --data-file=- --replication-policy=automatic

# (opcjonalny, FR sellers — pomiń jeśli Pappers paid niepotrzebny)
# printf '%s' "$PAPPERS_API_KEY"        | gcloud secrets create pappers-api-key          --data-file=- --replication-policy=automatic

# sprawdź
gcloud secrets list
```

### 1B. Service account permissions

SA `luko-sellers-worker@luko-sellers.iam.gserviceaccount.com` musi mieć:

| Rola | Po co |
|---|---|
| `roles/bigquery.dataViewer` na dataset `luko_sellers` | czytanie `sellers_raw` pending sellers |
| `roles/bigquery.dataEditor` na dataset `luko_sellers` | write enriched rows do `sellers_enriched` |
| `roles/bigquery.jobUser` na project | uruchamianie BQ queries |
| `roles/secretmanager.secretAccessor` per-secret | dostęp do 3 sekretów |
| `roles/run.invoker` na Cloud Run service | wywołanie z Cloud Scheduler |

Komendy:

```bash
PROJECT=luko-sellers
SA=luko-sellers-worker@luko-sellers.iam.gserviceaccount.com

# project-level BQ Job User
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/bigquery.jobUser"

# dataset-level BQ DataViewer + DataEditor
# (musisz to zrobić via Console UI lub bq update --set_iam_policy bo CLI 
#  per-dataset binding wymaga JSON policy)
bq show --format=prettyjson luko_sellers:luko_sellers > /tmp/ds_policy.json
# ręcznie edytuj /tmp/ds_policy.json access[]: dodaj
#   { "role": "READER", "userByEmail": "<SA>" }
#   { "role": "WRITER", "userByEmail": "<SA>" }
bq update --source /tmp/ds_policy.json luko_sellers:luko_sellers

# Secret Manager — per-secret accessor
for s in brave-api-key companies-house-api-key anthropic-api-key; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 1C. Sanity — czy SA może czytać dataset

```bash
# z Cloud Shell albo lokalnie z gcloud auth as luko@netanaliza.com:
gcloud iam service-accounts keys create /tmp/sa-test.json \
  --iam-account=$SA
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-test.json \
  bq query --use_legacy_sql=false \
    "SELECT COUNT(*) FROM \`luko-sellers.luko_sellers.sellers_raw\`"
# powinno zwrócić liczbę, nie permission-denied
rm /tmp/sa-test.json  # natychmiast po teście
```

---

## 2. Deploy — Cloud Run (30-45 min)

### 2A. Dockerfile (commit przed deployem)

Lokalizacja: `seller-capture/enrichment/Dockerfile`. Wstępny template:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY enrichment/ /app/enrichment/
COPY bq/ /app/bq/
RUN pip install --no-cache-dir -r enrichment/requirements.txt

# Entry: poll pending sellers, enrich, write back. Limit 20 per invocation
# (Cloud Run timeout 60min — 20 sellers × ~30s = 10min, safe margin).
CMD ["python", "-m", "enrichment.main", "pending", "--limit=20"]
```

> **TODO przed deployem**: dodać `enrichment/main.py:pending` handler który
> pulluje N sellers ze statusem `pending` z BQ, enriches via `enrich_one`,
> writes wynik do `sellers_enriched`. Brzegowy code paths są napisane
> (write_back), brakuje pętli.

### 2B. Build + push do Artifact Registry

```bash
# włącz Artifact Registry
gcloud services enable artifactregistry.googleapis.com

# utwórz repo (raz)
gcloud artifacts repositories create luko-enrichment \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Seller enrichment worker images"

# build + push (Cloud Build, server-side — nie wymaga lokalnego Docker)
gcloud builds submit seller-capture/ \
  --tag europe-west1-docker.pkg.dev/luko-sellers/luko-enrichment/worker:v1
```

### 2C. Deploy Cloud Run service

```bash
gcloud run deploy luko-enrichment-worker \
  --image=europe-west1-docker.pkg.dev/luko-sellers/luko-enrichment/worker:v1 \
  --region=europe-west1 \
  --service-account=$SA \
  --no-allow-unauthenticated \
  --timeout=3600 \
  --memory=1Gi \
  --cpu=1 \
  --max-instances=1 \
  --set-env-vars="BQ_PROJECT_ID=luko-sellers,BQ_DATASET=luko_sellers,LOG_LEVEL=INFO" \
  --set-secrets="BRAVE_API_KEY=brave-api-key:latest,COMPANIES_HOUSE_API_KEY=companies-house-api-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

**Uwagi:**
- `--max-instances=1` — wymusza pojedynczy worker, brak race condition na BQ writes
- `--timeout=3600` — 60min cap; przy `--limit=20` i ~30s/seller jeden run = ~10min
- `--no-allow-unauthenticated` — tylko Cloud Scheduler (też z `$SA`) może wywołać

### 2D. Smoke test

```bash
# wywołaj raz ręcznie jako $SA z IAM token
TOKEN=$(gcloud auth print-identity-token --impersonate-service-account=$SA)
URL=$(gcloud run services describe luko-enrichment-worker --region=europe-west1 --format='value(status.url)')
curl -X POST -H "Authorization: Bearer $TOKEN" "$URL"

# w Cloud Logging poszukaj "wrote 20 enriched rows" albo "no pending sellers"
```

---

## 3. Schedule — Cloud Scheduler co 1h (10 min)

```bash
# włącz Scheduler
gcloud services enable cloudscheduler.googleapis.com

# utwórz job (uses OIDC token authentication)
gcloud scheduler jobs create http enrichment-cron \
  --location=europe-west1 \
  --schedule="0 * * * *" \
  --uri="$URL" \
  --http-method=POST \
  --oidc-service-account-email=$SA \
  --oidc-token-audience="$URL" \
  --time-zone="Europe/Warsaw" \
  --attempt-deadline=3540s
```

Cron `0 * * * *` = każdą pełną godzinę. Dla 100 sellers/dzień:
- 24 invocations × 20 = 480 capacity per day → headroom dla skoków
- Średnio ~4-5 sellers/godzinę faktycznie pulled

Sprawdzenie:

```bash
gcloud scheduler jobs describe enrichment-cron --location=europe-west1
gcloud logging read "resource.type=cloud_scheduler_job" --limit=5 --freshness=2h
```

---

## 4. Estymowany monthly cost — 100 sellers/dzień (3000/m)

Na podstawie real-data run z bugfixami (B.1+B.2) na 29 fixturze:

- **Avg cost/seller**: $0.021 (2-pass tuned, threshold=50, registry-officer early-exit)
- **Mix**: ~60% UK Ltd (skip PASS 2 via registry rule, ~$0.003/seller), ~17% DE
  (skipped_de, $0), ~17% CN (mix agency-skip/escalate, $0.002-$0.30), ~6% other

Estymacja:

| Składnik | $ / 1k sellers | $ / m (3k) | Notatka |
|---|---|---|---|
| Anthropic API (Haiku PASS 1 + okazjonalny Sonnet PASS 2) | $21 | **$63** | Z B.1/B.2 fixów; cache amortizacja przy stałym ruchu obniża |
| Brave Search (~4 queries/seller × $5/1k queries) | $20 | **$60** | Free tier 1k queries/m pokryje ~250 sellers/m; reszta $5/1k |
| Companies House | $0 | $0 | free, 600 req/5min — wystarcza |
| Pappers | $0 | $0 | opcjonalny, FR-only |
| Cloud Run (24h × ~10min × 1 vCPU + 1Gi RAM) | $1 | $3 | free tier 180k vCPU-sec/m pokryje większość |
| BigQuery (3k rows insert + occasional scan) | $0 | $0 | free tier 10GB storage + 1TB query/m |
| Cloud Scheduler | $0 | $0 | first 3 jobs free |
| Secret Manager (4 secrets, ~720 reads/m) | $0 | $0 | free tier 10k reads/m |
| Logging (1 month retention) | $0 | $0 | free tier 50 GiB/m |
| **Razem (estymacja środkowa)** | | **~$125 / m** | dla 100 sellers/dzień |

**Skala wzwyż**: 500 sellers/dzień (~15k/m) → ~$525/m (LLM + Brave skalują liniowo).

**Bounds**:
- Optimistic ($75/m): większość sellers wpada w registry-officer skip path
  (UK Ltd cluster). Haiku-only batches kosztują ~$0.003/seller.
- Pessimistic ($200/m): dużo CN bez agency flag → PASS 2 escalation
  ~$0.20/seller. Brave też skaluje (bo każdy PASS 2 robi extra web search).

---

## 5. Rollback plan

### 5A. Pojedynczy seller wyszedł zły

Po prostu re-enrich:

```bash
# znajdź seller_id, ustaw status z powrotem na pending
bq query --use_legacy_sql=false \
  "UPDATE \`luko-sellers.luko_sellers.sellers_enriched\`
   SET status='pending' WHERE seller_id='AXXX'"
```

Następny cron run podniesie go ponownie.

### 5B. Bug w pipeline — wycofaj wersję obrazu

```bash
# lista wersji w Artifact Registry
gcloud artifacts docker tags list europe-west1-docker.pkg.dev/luko-sellers/luko-enrichment/worker

# redeploy poprzedniej wersji
gcloud run deploy luko-enrichment-worker \
  --image=europe-west1-docker.pkg.dev/luko-sellers/luko-enrichment/worker:v0 \
  --region=europe-west1
```

Zachowuj zawsze `v(n-1)` w Registry — przy `v3` deployu nie usuwaj `v2`.

### 5C. Wyłącz cron na czas debugu

```bash
gcloud scheduler jobs pause enrichment-cron --location=europe-west1
# ... debug ...
gcloud scheduler jobs resume enrichment-cron --location=europe-west1
```

### 5D. Klucz API skompromitowany

1. W console (Anthropic / Brave / CH) zrotuj klucz
2. Update secret:
   ```bash
   printf '%s' "$NEW_KEY" | gcloud secrets versions add anthropic-api-key --data-file=-
   ```
3. Force restart Cloud Run (żeby pull nowy `:latest` secret):
   ```bash
   gcloud run services update luko-enrichment-worker --region=europe-west1
   ```

### 5E. Awaria pełna — wstrzymanie wszystkiego

```bash
gcloud scheduler jobs pause enrichment-cron --location=europe-west1
gcloud run services update luko-enrichment-worker --region=europe-west1 --max-instances=0
```

Capture extension w Chrome działa dalej (zapisuje do `sellers_raw`) — pending
queue puchnie, ale nic złego się nie dzieje.

---

## 6. Monitoring (opcjonalny, ale rekomendowany)

### 6A. Alert na koszt > $200/m

Console → Billing → **Budgets & alerts** → Create budget:
- Scope: project `luko-sellers`
- Amount: $200
- Threshold rules: 50%, 90%, 100%
- Email do `luko@netanaliza.com`

### 6B. Alert na enrichment errors

```bash
gcloud logging metrics create enrichment_errors \
  --description="Count of enrichment_failed in last run" \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="luko-enrichment-worker" AND jsonPayload.message=~"enrich failed for"'
```

Potem w Console → Monitoring → **Alerting** → Create policy na tym metric
z thresholdem "> 5 errors w 10min".

---

## 7. Pre-deploy decyzje do potwierdzenia

Zanim odpalisz Krok 1A:

1. **Region**: `europe-west1` (Belgia) — najbliżej GBP/EUR sellers. Inny region?
2. **Cron frequency**: `0 * * * *` (co 1h, limit=20). Chcesz częściej? `*/30 * * * *`?
3. **Branch source**: deploy z `main` po merge, czy z feature branch `claude/amazon-seller-data-verification-EnYEl` jako preview?
4. **Brave plan**: free tier wystarcza dla ~250 sellers/m, dalej $5/1k queries. Upgrade do "Data for AI Pro" (mniej queries per cost) opłacalny od ~1500 sellers/m.
5. **PAPPERS_API_KEY**: deploy bez (FR sellers pomijane) czy z (płatny ~$50/m za 5k queries)?

---

## 8. Post-deploy verification (10 min)

Po pierwszym cron tick:

```bash
# 1. czy worker poleciał
gcloud logging read 'resource.labels.service_name="luko-enrichment-worker"' \
  --limit=20 --freshness=1h --format='value(jsonPayload.message)'

# 2. czy wrote do BQ
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) AS enriched_today
   FROM \`luko-sellers.luko_sellers.sellers_enriched\`
   WHERE DATE(enriched_at) = CURRENT_DATE()"

# 3. spot-check 1 enriched row
bq query --use_legacy_sql=false \
  "SELECT seller_id, status, decision_maker_name, email, confidence_overall, agency_flag
   FROM \`luko-sellers.luko_sellers.sellers_enriched\`
   ORDER BY enriched_at DESC LIMIT 5"
```

Jeśli (1) puste, (2) zero, (3) brak rows → wróć do sekcji 2D Smoke test.

---

## Notes — co NIE jest w scope tej checklisty

- Backup BQ tabel (poziom danych) — osobny temat (`bq mkdir` snapshot + GCS).
- Backfill legacy danych z istniejących Sheets — `GCP_SETUP_PL.md` Krok 7.
- DKIM/DMARC dla outbound emaili — `SETUP.md` sekcja 0.
- Apps Script + Chrome extension capture flow — `GCP_SETUP_PL.md` Krok 6.

Te są niezależne; deploy Cloud Run workera nic z nimi nie ma wspólnego.
