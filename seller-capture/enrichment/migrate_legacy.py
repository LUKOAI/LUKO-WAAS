"""Backfill legacy Google Sheets into BQ.sellers_enriched.

Config-driven: each source declares its sheet, tab, column mapping, and constants.
Reads via Sheets API (service account), merges into BQ in batches with INSERT-IF-NOT-EXIST
semantics so re-runs are idempotent and never overwrite richer rows with poorer data.

Usage:
  python -m enrichment.migrate_legacy --source all
  python -m enrichment.migrate_legacy --source smartscout_de --dry-run
  python -m enrichment.migrate_legacy --source lao_calls_tracker
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from typing import Any, Callable

from google.cloud import bigquery
from google.oauth2 import service_account
from googleapiclient.discovery import build

log = logging.getLogger("migrate")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"),
                    format="%(asctime)s %(levelname)s: %(message)s")

PROJECT = os.environ["BQ_PROJECT_ID"]
DATASET = os.environ["BQ_DATASET"]
SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


@dataclass
class LegacySource:
    name: str
    sheet_id: str
    tab: str
    column_mapping: dict[str, str]        # target_field -> sheet_header (case-insensitive match)
    constants: dict[str, Any] = field(default_factory=dict)
    skip_if_no_seller_id: bool = True
    customer_flag: bool = False           # do NOT include in outreach worklist
    notes: str = ""
    transformers: dict[str, Callable[[str], str]] = field(default_factory=dict)


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _clean_seller_id(v: str) -> str:
    """Amazon seller IDs look like A[A-Z0-9]{12,15}. Pull from raw cell or URL."""
    if not v:
        return ""
    v = v.strip()
    import re
    m = re.search(r"\b(A[0-9A-Z]{10,16})\b", v)
    return m.group(1) if m else ""


def _maybe_marketplace_from_url(v: str) -> str:
    if not v:
        return ""
    import re
    m = re.search(r"amazon\.([a-z.]{2,6})", v.lower())
    return f"amazon.{m.group(1)}" if m else ""


# ---------------------------------------------------------------------------
# Source definitions — derived from the audit report. Sheet IDs to be filled in
# when service-account access is granted (see TODO markers).
# ---------------------------------------------------------------------------

LEGACY_SOURCES: dict[str, LegacySource] = {
    "smartscout_de": LegacySource(
        name="smartscout_de",
        sheet_id="TODO_SHEET_ID_WYSYLANIE_EMAIL_GPSR",
        tab="Sellers",
        column_mapping={
            "seller_id": "SellerID",
            "business_name": "SellerName",
            "brands": "Brand",
            "email_raw": "Email",
            "country": "Country",
        },
        constants={"marketplace": "amazon.de", "status": "legacy_smartscout"},
        notes="22 MB DE export from 2023-11; bulk leads, names + brands + sometimes email",
        transformers={"seller_id": _clean_seller_id},
    ),
    "smartscout_pl": LegacySource(
        name="smartscout_pl",
        sheet_id="TODO_SHEET_ID_FIRMY_PL_SMARTSCOUT",
        tab="Sellers",
        column_mapping={
            "seller_id": "SellerID",
            "business_name": "SellerName",
            "brands": "Brand",
            "email_raw": "Email",
        },
        constants={"marketplace": "amazon.de", "country": "PL", "status": "legacy_smartscout"},
        notes="PL companies selling on amazon.de, 2023-10",
        transformers={"seller_id": _clean_seller_id},
    ),
    "gpsr_source_export": LegacySource(
        name="gpsr_source_export",
        sheet_id="TODO_SHEET_ID_GPSR_SOURCE_EXPORT",
        tab="Sheet1",
        column_mapping={
            "seller_id": "SellerID",
            "business_name": "SellerName",
            "email_raw": "Email",
            "country": "Country",
        },
        constants={"status": "legacy_gpsr"},
        notes="GPSR mailing master export — has emails for many sellers",
        transformers={"seller_id": _clean_seller_id},
    ),
    "linkedin_pipeline": LegacySource(
        name="linkedin_pipeline",
        sheet_id="TODO_SHEET_ID_AMAZONSELLERS_LINKEDIN",
        tab="Pipeline",
        column_mapping={
            "seller_id": "Seller ID Amazon",
            "business_name": "Firma",
            "email_raw": "E-Mail",
            "phone_raw": "Telefon",
            "country": "Land",
            "business_address": "Adresse",
            "decision_maker_name": "Vorname",        # combined later with Nachname
            "_nachname": "Nachname",
            "vat": "VAT ID",
            "website": "Webseite",
            "brands": "Brand Name Amazon",
        },
        constants={"status": "legacy_linkedin_pipeline"},
        notes="55-col CRM-style pipeline — highest quality legacy data, already partly phone-verified",
        transformers={"seller_id": _clean_seller_id},
    ),
    "lao_calls_tracker": LegacySource(
        name="lao_calls_tracker",
        sheet_id="TODO_SHEET_ID_FIRMY_PL_LAO_CALLS",
        tab="Calls",
        column_mapping={
            "seller_id": "SellerID",
            "business_name": "Firma",
            "phone_raw": "Telefon",
            "email_raw": "E-mail",
            "website": "WWW",
            "decision_maker_name": "Osoba decyzyjna",
            "decision_maker_role": "Stanowisko",
        },
        constants={"marketplace": "amazon.de", "country": "PL", "status": "lao_already_called"},
        notes="Already-called sellers from LAO product — DO NOT re-contact for LAO; OK for SitePatron",
        transformers={"seller_id": _clean_seller_id},
    ),
    "klienci_netanaliza": LegacySource(
        name="klienci_netanaliza",
        sheet_id="TODO_SHEET_ID_KLIENCI_ASIN_BRANZA",
        tab="Sheet1",
        column_mapping={
            "seller_id": "Seller ID",
            "business_name": "Nazwa firmy",
            "email_raw": "Email",
            "phone_raw": "Telefon",
            "vat": "NIP / VAT",
            "country": "Kraj",
        },
        constants={"status": "is_customer"},
        customer_flag=True,
        notes="EXISTING CUSTOMERS — flag, never outreach as lead",
        transformers={"seller_id": _clean_seller_id},
    ),
}


# ---------------------------------------------------------------------------

def _sheets_client():
    creds_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=SHEETS_SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _bq() -> bigquery.Client:
    return bigquery.Client(project=PROJECT)


def read_sheet(svc, sheet_id: str, tab: str) -> tuple[list[str], list[list[str]]]:
    rng = f"'{tab}'"
    res = svc.spreadsheets().values().get(spreadsheetId=sheet_id, range=rng).execute()
    values = res.get("values", [])
    if not values:
        return [], []
    headers = [h.strip() for h in values[0]]
    rows = values[1:]
    rows = [r + [""] * (len(headers) - len(r)) for r in rows]
    return headers, rows


def _column_index(headers: list[str], wanted: str) -> int:
    target = _norm(wanted)
    for i, h in enumerate(headers):
        if _norm(h) == target:
            return i
    for i, h in enumerate(headers):
        if target in _norm(h):
            return i
    return -1


def project_rows(src: LegacySource, headers: list[str], rows: list[list[str]]) -> list[dict]:
    idx: dict[str, int] = {field: _column_index(headers, col) for field, col in src.column_mapping.items()}
    missing = [f for f, i in idx.items() if i < 0]
    if missing:
        log.warning("%s: missing columns in sheet: %s", src.name, missing)

    out: list[dict] = []
    for r in rows:
        rec: dict[str, Any] = {}
        for field, i in idx.items():
            if i < 0:
                continue
            val = (r[i] or "").strip()
            tx = src.transformers.get(field)
            if tx:
                val = tx(val)
            rec[field] = val

        if src.skip_if_no_seller_id and not rec.get("seller_id"):
            continue

        if "_nachname" in rec:
            full = " ".join([rec.get("decision_maker_name", ""), rec.get("_nachname", "")]).strip()
            if full:
                rec["decision_maker_name"] = full
            rec.pop("_nachname", None)

        for k, v in src.constants.items():
            rec.setdefault(k, v)

        if src.customer_flag:
            rec["is_customer"] = True

        if not rec.get("marketplace"):
            mp = _maybe_marketplace_from_url(rec.get("business_name", "")) or ""
            if mp:
                rec["marketplace"] = mp

        out.append(rec)
    return out


def write_bq(records: list[dict], src_name: str, dry_run: bool) -> int:
    if not records:
        return 0
    if dry_run:
        log.info("[dry-run] %s: would merge %d rows", src_name, len(records))
        for r in records[:3]:
            log.info("  sample: %s", {k: v for k, v in r.items() if k in ("seller_id", "business_name", "email_raw", "phone_raw", "status")})
        return len(records)

    bq = _bq()
    staging = f"_stage_{src_name}"
    schema = [
        bigquery.SchemaField("seller_id", "STRING"),
        bigquery.SchemaField("marketplace", "STRING"),
        bigquery.SchemaField("business_name", "STRING"),
        bigquery.SchemaField("business_address", "STRING"),
        bigquery.SchemaField("country", "STRING"),
        bigquery.SchemaField("email_raw", "STRING"),
        bigquery.SchemaField("phone_raw", "STRING"),
        bigquery.SchemaField("vat", "STRING"),
        bigquery.SchemaField("website", "STRING"),
        bigquery.SchemaField("brands", "STRING"),
        bigquery.SchemaField("decision_maker_name", "STRING"),
        bigquery.SchemaField("decision_maker_role", "STRING"),
        bigquery.SchemaField("status", "STRING"),
        bigquery.SchemaField("is_customer", "BOOL"),
        bigquery.SchemaField("legacy_source", "STRING"),
    ]
    table_id = f"{PROJECT}.{DATASET}.{staging}"
    bq.delete_table(table_id, not_found_ok=True)
    bq.create_table(bigquery.Table(table_id, schema=schema))

    rows_for_load = []
    for r in records:
        rows_for_load.append({
            "seller_id": r.get("seller_id") or "",
            "marketplace": r.get("marketplace") or None,
            "business_name": r.get("business_name") or None,
            "business_address": r.get("business_address") or None,
            "country": r.get("country") or None,
            "email_raw": r.get("email_raw") or None,
            "phone_raw": r.get("phone_raw") or None,
            "vat": r.get("vat") or None,
            "website": r.get("website") or None,
            "brands": r.get("brands") or None,
            "decision_maker_name": r.get("decision_maker_name") or None,
            "decision_maker_role": r.get("decision_maker_role") or None,
            "status": r.get("status") or "legacy_imported",
            "is_customer": bool(r.get("is_customer")),
            "legacy_source": src_name,
        })
    errors = bq.insert_rows_json(table_id, rows_for_load)
    if errors:
        log.error("insert_rows_json errors (first 3): %s", errors[:3])
        raise RuntimeError("BQ insert failed")

    merge = f"""
    MERGE `{PROJECT}.{DATASET}.sellers_enriched` T
    USING `{table_id}` S
    ON T.seller_id = S.seller_id
    WHEN MATCHED THEN UPDATE SET
      marketplace = COALESCE(T.marketplace, S.marketplace),
      business_name = COALESCE(T.business_name, S.business_name),
      business_address = COALESCE(T.business_address, S.business_address),
      country = COALESCE(T.country, S.country),
      email_raw = COALESCE(T.email_raw, S.email_raw),
      phone_raw = COALESCE(T.phone_raw, S.phone_raw),
      vat = COALESCE(T.vat, S.vat),
      website = COALESCE(T.website, S.website),
      decision_maker_name = COALESCE(T.decision_maker_name, S.decision_maker_name),
      decision_maker_role = COALESCE(T.decision_maker_role, S.decision_maker_role),
      brands = ARRAY(SELECT DISTINCT b FROM UNNEST(ARRAY_CONCAT(IFNULL(T.brands,[]), IF(S.brands IS NULL,[],[S.brands]))) AS b WHERE b IS NOT NULL AND b != ''),
      status = IF(S.is_customer, 'is_customer', IF(T.status IN ('captured_pending_enrich','enriched_ok','enriched_low_confidence'), T.status, S.status))
    WHEN NOT MATCHED THEN INSERT (
      seller_id, marketplace, business_name, business_address, country,
      email_raw, phone_raw, vat, website, brands,
      decision_maker_name, decision_maker_role,
      status, last_captured_at
    ) VALUES (
      S.seller_id, S.marketplace, S.business_name, S.business_address, S.country,
      S.email_raw, S.phone_raw, S.vat, S.website,
      IF(S.brands IS NULL OR S.brands='', NULL, [S.brands]),
      S.decision_maker_name, S.decision_maker_role,
      IF(S.is_customer, 'is_customer', S.status), CURRENT_TIMESTAMP()
    )
    """
    bq.query(merge).result()
    bq.delete_table(table_id, not_found_ok=True)
    return len(records)


def run_source(name: str, dry_run: bool, limit: int | None) -> int:
    if name not in LEGACY_SOURCES:
        raise SystemExit(f"unknown source: {name}. Known: {list(LEGACY_SOURCES)}")
    src = LEGACY_SOURCES[name]
    if src.sheet_id.startswith("TODO_"):
        log.warning("%s: sheet_id placeholder — fill in real ID before running", name)
        return 0
    log.info("== %s ==", name)
    svc = _sheets_client()
    headers, rows = read_sheet(svc, src.sheet_id, src.tab)
    if limit:
        rows = rows[:limit]
    log.info("read %d rows from %s/%s", len(rows), src.sheet_id, src.tab)
    records = project_rows(src, headers, rows)
    log.info("projected to %d records with seller_id", len(records))
    return write_bq(records, name, dry_run)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="all", help="source name or 'all'")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="cap rows per source")
    args = ap.parse_args(argv)
    sources = list(LEGACY_SOURCES) if args.source == "all" else [args.source]
    total = 0
    for s in sources:
        try:
            total += run_source(s, args.dry_run, args.limit)
        except Exception:
            log.exception("source %s failed", s)
    log.info("migrated %d rows total (dry_run=%s)", total, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
