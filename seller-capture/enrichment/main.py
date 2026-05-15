"""Enrichment orchestrator.

Pulls sellers in status='captured_pending_enrich' (or a manual list) from BigQuery,
runs the source pipeline, merges results, scores contacts, writes back.

Run modes:
  python -m enrichment.main pending --limit 100
  python -m enrichment.main seller A1B2C3D4
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import asdict
from typing import Iterable

from google.cloud import bigquery

from .models import SellerInput, EnrichmentResult
from .pipeline import enrich_one
from .scoring import compute_overall

log = logging.getLogger("enrich")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")

PROJECT = os.environ["BQ_PROJECT_ID"]
DATASET = os.environ["BQ_DATASET"]


def _bq() -> bigquery.Client:
    return bigquery.Client(project=PROJECT)


_SELECT_FIELDS = """
  e.seller_id, e.marketplace, e.business_name, e.business_address, e.country,
  e.vat, e.registry_id, e.phone_raw, e.email_raw,
  latest.raw_text AS raw_text, latest.gpsr_raw AS gpsr_raw
"""


def _latest_raw_join() -> str:
    return f"""
    LEFT JOIN (
      SELECT seller_id,
             ARRAY_AGG(raw_text IGNORE NULLS ORDER BY captured_at DESC LIMIT 1)[SAFE_OFFSET(0)] AS raw_text,
             ARRAY_AGG(gpsr_raw IGNORE NULLS ORDER BY captured_at DESC LIMIT 1)[SAFE_OFFSET(0)] AS gpsr_raw
      FROM `{PROJECT}.{DATASET}.sellers_raw`
      GROUP BY seller_id
    ) latest USING (seller_id)
    """


def fetch_pending(limit: int) -> list[SellerInput]:
    sql = f"""
    SELECT {_SELECT_FIELDS}
    FROM `{PROJECT}.{DATASET}.sellers_enriched` e
    {_latest_raw_join()}
    WHERE e.status = 'captured_pending_enrich'
    ORDER BY e.last_captured_at DESC
    LIMIT @lim
    """
    job = _bq().query(sql, job_config=bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("lim", "INT64", limit)]
    ))
    return [SellerInput(**dict(r)) for r in job.result()]


def fetch_one(seller_id: str) -> SellerInput | None:
    sql = f"""
    SELECT {_SELECT_FIELDS}
    FROM `{PROJECT}.{DATASET}.sellers_enriched` e
    {_latest_raw_join()}
    WHERE e.seller_id = @sid LIMIT 1
    """
    job = _bq().query(sql, job_config=bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("sid", "STRING", seller_id)]
    ))
    for r in job.result():
        return SellerInput(**dict(r))
    return None


def write_back(result: EnrichmentResult) -> None:
    sql = f"""
    UPDATE `{PROJECT}.{DATASET}.sellers_enriched`
    SET company_name = @company_name,
        legal_form = @legal_form,
        business_address = COALESCE(NULLIF(@business_address,''), business_address),
        country = COALESCE(NULLIF(@country,''), country),
        vat = COALESCE(NULLIF(@vat,''), vat),
        registry_id = COALESCE(NULLIF(@registry_id,''), registry_id),
        decision_maker_name = @dm_name,
        decision_maker_role = @dm_role,
        email = @email,
        phone = @phone,
        website = @website,
        other_urls = @other_urls,
        tech_stack = @tech_stack,
        brands = @brands,
        officers = @officers,
        agency_flag = NULLIF(@agency_flag,''),
        generic_contacts = @generic_contacts,
        weee_number = NULLIF(@weee_number,''),
        lucid_id = NULLIF(@lucid_id,''),
        de_operating_signals = @de_signals,
        jurisdiction_segment = @j_segment,
        jurisdiction_reason = NULLIF(@j_reason,''),
        outreach_priority = @outreach_priority,
        confidence_company = @c_company,
        confidence_email = @c_email,
        confidence_phone = @c_phone,
        confidence_overall = @c_overall,
        sources = @sources,
        status = @status,
        last_enriched_at = CURRENT_TIMESTAMP()
    WHERE seller_id = @sid
    """
    p = result
    overall = compute_overall(p)
    params = [
        bigquery.ScalarQueryParameter("sid", "STRING", p.seller_id),
        bigquery.ScalarQueryParameter("company_name", "STRING", p.company_name or ""),
        bigquery.ScalarQueryParameter("legal_form", "STRING", p.legal_form or ""),
        bigquery.ScalarQueryParameter("business_address", "STRING", p.business_address or ""),
        bigquery.ScalarQueryParameter("country", "STRING", p.country or ""),
        bigquery.ScalarQueryParameter("vat", "STRING", p.vat or ""),
        bigquery.ScalarQueryParameter("registry_id", "STRING", p.registry_id or ""),
        bigquery.ScalarQueryParameter("dm_name", "STRING", p.decision_maker_name or ""),
        bigquery.ScalarQueryParameter("dm_role", "STRING", p.decision_maker_role or ""),
        bigquery.ScalarQueryParameter("email", "STRING", p.email or ""),
        bigquery.ScalarQueryParameter("phone", "STRING", p.phone or ""),
        bigquery.ScalarQueryParameter("website", "STRING", p.website or ""),
        bigquery.ArrayQueryParameter("other_urls", "STRING", p.other_urls or []),
        bigquery.ArrayQueryParameter("tech_stack", "STRING", p.tech_stack or []),
        bigquery.ArrayQueryParameter("brands", "STRING", p.brands or []),
        bigquery.ScalarQueryParameter("agency_flag", "STRING", p.agency_flag or ""),
        bigquery.ScalarQueryParameter("officers", "STRING", json.dumps(p.officers or [])),
        bigquery.ScalarQueryParameter("generic_contacts", "STRING", json.dumps(p.generic_contacts or [])),
        bigquery.ScalarQueryParameter("weee_number", "STRING", p.weee_number or ""),
        bigquery.ScalarQueryParameter("lucid_id", "STRING", p.lucid_id or ""),
        bigquery.ArrayQueryParameter("de_signals", "STRING", p.de_operating_signals or []),
        bigquery.ScalarQueryParameter("j_segment", "STRING", p.jurisdiction_segment or "unknown"),
        bigquery.ScalarQueryParameter("j_reason", "STRING", p.jurisdiction_reason or ""),
        bigquery.ScalarQueryParameter("outreach_priority", "STRING", p.outreach_priority or "review"),
        bigquery.ScalarQueryParameter("c_company", "INT64", p.confidence.get("company", 0)),
        bigquery.ScalarQueryParameter("c_email", "INT64", p.confidence.get("email", 0)),
        bigquery.ScalarQueryParameter("c_phone", "INT64", p.confidence.get("phone", 0)),
        bigquery.ScalarQueryParameter("c_overall", "INT64", overall),
        bigquery.ScalarQueryParameter("sources", "STRING", json.dumps(p.sources or {})),
        bigquery.ScalarQueryParameter("status", "STRING", p.status),
    ]
    _bq().query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()


def run_batch(sellers: Iterable[SellerInput]) -> None:
    for s in sellers:
        try:
            log.info("enrich %s (%s)", s.seller_id, s.marketplace)
            result = enrich_one(s)
            write_back(result)
            log.info(
                "  -> status=%s segment=%s priority=%s signals=%s overall=%s",
                result.status,
                result.jurisdiction_segment,
                result.outreach_priority,
                ",".join(result.de_operating_signals) or "-",
                result.confidence.get("overall"),
            )
        except Exception:
            log.exception("enrichment failed for %s", s.seller_id)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_pending = sub.add_parser("pending")
    p_pending.add_argument("--limit", type=int, default=50)
    p_one = sub.add_parser("seller")
    p_one.add_argument("seller_id")
    args = ap.parse_args(argv)
    if args.cmd == "pending":
        run_batch(fetch_pending(args.limit))
    elif args.cmd == "seller":
        s = fetch_one(args.seller_id)
        if not s:
            log.error("not found"); return 2
        run_batch([s])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
