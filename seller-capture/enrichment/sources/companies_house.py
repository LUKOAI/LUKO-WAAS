"""Companies House — UK official company registry. Free, public, JSON.

API base:  https://api.company-information.service.gov.uk
Auth:      HTTP Basic — username = API key, password = "" (empty string)
Rate:      600 requests / 5 min per IP. tenacity backs us off on 429 / 5xx.

We use three endpoints:
  GET /company/{number}            → company profile
  GET /search/companies?q=...      → name search (returns items[])
  GET /company/{number}/officers   → directors + officers

Output shape (lookup_by_number):
  {
    'company_name': str, 'company_number': str, 'legal_form': str | None,
    'status': str | None, 'jurisdiction': str | None,
    'address': str | None, 'country': str | None,
    'incorporated_on': str | None,
    'officers': [
        {'name': str, 'role': str | None,
         'appointed_on': str | None, 'resigned_on': str | None,
         'nationality': str | None}, ...
    ],
    'source': 'companies_house',
  }
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)

BASE = "https://api.company-information.service.gov.uk"
# UK company numbers: 8 digits, optionally prefixed by 2 letters (SC, NI, OC, LP, FC, etc).
COMPANY_NUMBER_RE = re.compile(r"^[A-Z]{0,2}\d{6,8}$")


def _api_key() -> Optional[str]:
    return os.environ.get("COMPANIES_HOUSE_API_KEY")


def _normalize_number(raw: str) -> Optional[str]:
    if not raw:
        return None
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
    # Pad pure-digit numbers to 8 chars ("123456" → "00123456") — CH stores them zero-padded.
    if cleaned.isdigit() and len(cleaned) < 8:
        cleaned = cleaned.zfill(8)
    return cleaned if COMPANY_NUMBER_RE.match(cleaned) else None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def _get(path: str, params: dict | None = None) -> Optional[dict]:
    key = _api_key()
    if not key:
        log.warning("COMPANIES_HOUSE_API_KEY not set; skipping Companies House")
        return None
    r = requests.get(f"{BASE}{path}", params=params, auth=(key, ""), timeout=15)
    if r.status_code == 404:
        return None
    if r.status_code == 429:
        # tenacity will retry; surface as exception to trigger backoff
        raise RuntimeError("Companies House rate limit")
    if r.status_code != 200:
        log.warning("CH HTTP %s for %s", r.status_code, path)
        return None
    return r.json()


def _fmt_address(addr: dict | None) -> Optional[str]:
    if not addr:
        return None
    parts = [
        addr.get("premises"),
        addr.get("address_line_1"),
        addr.get("address_line_2"),
        addr.get("locality"),
        addr.get("region"),
        addr.get("postal_code"),
        addr.get("country"),
    ]
    return ", ".join(p for p in parts if p) or None


def lookup_by_number(number: str) -> Optional[dict]:
    """Fetch profile + officers for a UK company by company number."""
    norm = _normalize_number(number)
    if not norm:
        return None
    profile = _get(f"/company/{norm}")
    if not profile:
        return None

    officers_resp = _get(f"/company/{norm}/officers") or {}
    officers = []
    for it in officers_resp.get("items", []) or []:
        if it.get("resigned_on"):
            continue  # skip resigned officers
        officers.append({
            "name": (it.get("name") or "").strip() or None,
            "role": it.get("officer_role") or None,
            "appointed_on": it.get("appointed_on"),
            "resigned_on": it.get("resigned_on"),
            "nationality": it.get("nationality") or None,
        })

    return {
        "company_name": (profile.get("company_name") or "").strip() or None,
        "company_number": profile.get("company_number") or norm,
        "legal_form": profile.get("type") or None,            # 'ltd', 'plc', 'llp', ...
        "status": profile.get("company_status") or None,      # 'active', 'dissolved', ...
        "jurisdiction": profile.get("jurisdiction") or None,
        "address": _fmt_address(profile.get("registered_office_address")),
        "country": (profile.get("registered_office_address") or {}).get("country"),
        "incorporated_on": profile.get("date_of_creation"),
        "officers": officers,
        "source": "companies_house",
    }


def search_by_name(name: str, items_per_page: int = 5) -> list[dict]:
    """Name search — returns trimmed candidate list. Caller decides which to fetch in full."""
    if not name or not name.strip():
        return []
    resp = _get("/search/companies", params={"q": name, "items_per_page": items_per_page})
    if not resp:
        return []
    out = []
    for it in resp.get("items", []) or []:
        out.append({
            "company_name": (it.get("title") or "").strip() or None,
            "company_number": it.get("company_number"),
            "address_snippet": it.get("address_snippet"),
            "status": it.get("company_status"),
            "incorporated_on": it.get("date_of_creation"),
        })
    return out
