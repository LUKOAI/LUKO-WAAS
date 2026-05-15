"""Local CSV runner — run the enrichment pipeline on a CSV file without BigQuery.

Usage:
    python -m enrichment.local_run input.csv output.csv [--limit N]

Input CSV columns (header row required, all optional except seller_id):
    seller_id          — unique identifier (any string)
    country            — country name or 2-letter code (DE, GB, PL, IT, ...)
    vat                — VAT id with country prefix (DE123..., GB123...)
    business_name      — name from Amazon
    business_address   — address from Amazon
    registry_id        — UK company number, French SIREN, etc. (optional)
    phone_raw          — phone as shown on Amazon (optional)
    email_raw          — email as shown on Amazon (optional)
    raw_text           — any extra text scraped from the page (impressum
                         hints, GPSR section, fulfilment text — all useful)
    gpsr_raw           — GPSR section text from Amazon listing (optional)

Extra columns in the input are ignored. Missing columns default to empty.

Output CSV gets every input column plus:
    status, jurisdiction_segment, outreach_priority,
    company_name, decision_maker_name, decision_maker_role,
    email, phone, agency_flag, weee_number, lucid_id,
    de_operating_signals, confidence_overall, notes_json,
    officers_json, sources_json, website
"""
from __future__ import annotations

import argparse
import csv
import dataclasses
import json
import logging
import os
import sys
from typing import Iterator

from .models import SellerInput
from .pipeline import enrich_one

log = logging.getLogger("local_run")
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

INPUT_FIELDS = {
    "seller_id", "country", "vat", "business_name", "business_address",
    "registry_id", "phone_raw", "email_raw", "raw_text", "gpsr_raw",
}

OUTPUT_FIELDS = [
    # echo input
    "seller_id", "country", "vat", "business_name", "business_address",
    "registry_id", "phone_raw", "email_raw",
    # enrichment result
    "status", "jurisdiction_segment", "jurisdiction_reason", "outreach_priority",
    "company_name", "legal_form",
    "decision_maker_name", "decision_maker_role", "email", "phone", "website",
    "agency_flag",
    "weee_number", "lucid_id", "de_operating_signals",
    "confidence_overall", "confidence_company", "confidence_email", "confidence_phone",
    "notes_json", "officers_json", "sources_json",
]


def _row_to_input(row: dict) -> SellerInput:
    kwargs = {k: (row.get(k) or "").strip() or None for k in INPUT_FIELDS}
    sid = kwargs.pop("seller_id", None)
    if not sid:
        raise ValueError("row missing seller_id")
    return SellerInput(seller_id=sid, **kwargs)


def _result_to_row(s: SellerInput, r) -> dict:
    return {
        # input echo
        "seller_id": s.seller_id,
        "country": s.country or "",
        "vat": s.vat or "",
        "business_name": s.business_name or "",
        "business_address": s.business_address or "",
        "registry_id": s.registry_id or "",
        "phone_raw": s.phone_raw or "",
        "email_raw": s.email_raw or "",
        # output
        "status": r.status,
        "jurisdiction_segment": r.jurisdiction_segment,
        "jurisdiction_reason": r.jurisdiction_reason or "",
        "outreach_priority": r.outreach_priority,
        "company_name": r.company_name or "",
        "legal_form": r.legal_form or "",
        "decision_maker_name": r.decision_maker_name or "",
        "decision_maker_role": r.decision_maker_role or "",
        "email": r.email or "",
        "phone": r.phone or "",
        "website": r.website or "",
        "agency_flag": r.agency_flag or "",
        "weee_number": r.weee_number or "",
        "lucid_id": r.lucid_id or "",
        "de_operating_signals": "|".join(r.de_operating_signals or []),
        "confidence_overall": r.confidence.get("overall", 0) if r.confidence else 0,
        "confidence_company": r.confidence.get("company", 0) if r.confidence else 0,
        "confidence_email": r.confidence.get("email", 0) if r.confidence else 0,
        "confidence_phone": r.confidence.get("phone", 0) if r.confidence else 0,
        "notes_json": json.dumps(r.notes or [], ensure_ascii=False),
        "officers_json": json.dumps(r.officers or [], ensure_ascii=False),
        "sources_json": json.dumps(r.sources or {}, ensure_ascii=False),
    }


def _iter_input(path: str, limit: int | None) -> Iterator[SellerInput]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "seller_id" not in reader.fieldnames:
            raise SystemExit(f"Input CSV must contain a 'seller_id' column. Got: {reader.fieldnames}")
        for i, row in enumerate(reader):
            if limit is not None and i >= limit:
                return
            try:
                yield _row_to_input(row)
            except Exception as exc:
                log.warning("skipping row %d: %s", i + 1, exc)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Run enrichment pipeline locally on a CSV file.")
    ap.add_argument("input", help="Input CSV path")
    ap.add_argument("output", help="Output CSV path")
    ap.add_argument("--limit", type=int, default=None, help="Process only the first N rows")
    ap.add_argument("--continue-on-error", action="store_true",
                    help="Keep going when a single seller fails (default: skip with warning)")
    args = ap.parse_args(argv)

    log.info("reading from %s", args.input)
    log.info("writing to   %s", args.output)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.warning("ANTHROPIC_API_KEY not set — LLM merge step will be skipped")
    if not os.environ.get("COMPANIES_HOUSE_API_KEY"):
        log.warning("COMPANIES_HOUSE_API_KEY not set — UK Companies House skipped")
    if not os.environ.get("PAPPERS_API_KEY"):
        log.warning("PAPPERS_API_KEY not set — French Pappers skipped")
    if not os.environ.get("GOOGLE_CSE_KEY") or not os.environ.get("GOOGLE_CSE_ID"):
        log.warning("GOOGLE_CSE_KEY/ID not set — Google website-finder fallback skipped")

    n_ok = n_err = 0
    with open(args.output, "w", encoding="utf-8", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for s in _iter_input(args.input, args.limit):
            try:
                r = enrich_one(s)
                writer.writerow(_result_to_row(s, r))
                n_ok += 1
                log.info(
                    "  %s -> status=%s segment=%s priority=%s",
                    s.seller_id, r.status, r.jurisdiction_segment, r.outreach_priority,
                )
            except Exception:
                n_err += 1
                log.exception("enrichment failed for %s", s.seller_id)
                if not args.continue_on_error:
                    return 2

    log.info("done. processed=%d errors=%d", n_ok, n_err)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
