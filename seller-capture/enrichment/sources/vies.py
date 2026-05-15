"""VIES VAT validation — EU official, free, no auth.

Endpoint: https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number
Returns: valid, name, address (when member state shares them).
"""
from __future__ import annotations

import logging
from typing import Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)
URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def lookup(country_code: str, vat_number: str) -> Optional[dict]:
    payload = {"countryCode": country_code.upper(), "vatNumber": vat_number}
    r = requests.post(URL, json=payload, timeout=15)
    if r.status_code != 200:
        log.warning("VIES HTTP %s for %s%s", r.status_code, country_code, vat_number)
        return None
    data = r.json()
    return {
        "valid": bool(data.get("valid")),
        "name": (data.get("name") or "").strip() or None,
        "address": (data.get("address") or "").strip() or None,
        "country": data.get("countryCode"),
        "vat": (data.get("countryCode") or "") + (data.get("vatNumber") or ""),
        "request_date": data.get("requestDate"),
    }
