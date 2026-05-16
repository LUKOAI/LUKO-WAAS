# Cloud Run Job — enrichment worker for seller-capture pipeline.
# Build context is the parent (seller-capture/), so files are addressed as
# `enrichment/...`. Trigger via:
#   gcloud builds submit seller-capture/ --tag europe-west1-docker.pkg.dev/luko-sellers/luko-enrichment/worker:vN

FROM python:3.11-slim

WORKDIR /app

COPY enrichment/ /app/enrichment/

RUN pip install --no-cache-dir -r enrichment/requirements.txt

# One-shot batch: pulls up to 20 sellers w/ status='captured_pending_enrich'
# from BQ, enriches each via the source pipeline, writes back, then exits.
# Cloud Run Job re-runs us on every Scheduler tick — no HTTP listener needed.
CMD ["python", "-m", "enrichment.main", "pending", "--limit=20"]
