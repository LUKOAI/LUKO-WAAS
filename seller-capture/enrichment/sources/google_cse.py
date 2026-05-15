"""Google Custom Search JSON API — used as a last-ditch website finder.

When the Amazon-side raw text doesn't carry the seller's own URL, we fall back to:
  query = "<company_name> impressum"  (or mentions-legales for FR, aviso-legal for ES, ...)
The first result whose host isn't Amazon / social / a marketplace is treated as the
seller's website and handed off to impressum.lookup().

API:
  https://www.googleapis.com/customsearch/v1?key=K&cx=CX&q=...
Auth:
  GOOGLE_CSE_KEY  (Google Cloud API key, billing optional — first 100 req/day free)
  GOOGLE_CSE_ID   (the cx parameter from a Programmable Search Engine)
Quota:
  100 free / day per project. Worth saving for sellers we couldn't resolve otherwise.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional
from urllib.parse import urlparse

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)

URL = "https://www.googleapis.com/customsearch/v1"

# Match impressum.py — keeps the two finders in agreement about what isn't a website.
_BLOCKLIST_HOSTS = {
    "amazon.com", "amazon.de", "amazon.co.uk", "amazon.fr", "amazon.it", "amazon.es",
    "amazon.pl", "amazon.nl", "amazon.se", "amazon.ca", "amazon.com.mx", "amazon.co.jp",
    "ebay.com", "ebay.de", "ebay.co.uk", "ebay.fr",
    "kaufland.de", "otto.de", "allegro.pl", "etsy.com", "aliexpress.com", "alibaba.com",
    "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "linkedin.com", "tiktok.com", "pinterest.com",
    "google.com", "maps.google.com", "wikipedia.org",
    "trustpilot.com", "yelp.com",
}

# Query suffixes per likely seller jurisdiction; we try them in order and stop at the first hit.
LEGAL_SUFFIX_BY_COUNTRY = {
    "DE": ["impressum", "imprint"],
    "AT": ["impressum"],
    "CH": ["impressum"],
    "FR": ["mentions legales", "mentions-legales"],
    "BE": ["mentions legales", "impressum"],
    "ES": ["aviso legal", "aviso-legal"],
    "IT": ["informazioni legali", "note legali"],
    "PT": ["aviso legal"],
    "NL": ["impressum", "colofon"],
    "GB": ["legal notice", "imprint"],
    "IE": ["legal notice"],
}
_DEFAULT_SUFFIXES = ["impressum", "legal notice", "mentions legales", "aviso legal"]


def _credentials() -> tuple[str | None, str | None]:
    return os.environ.get("GOOGLE_CSE_KEY"), os.environ.get("GOOGLE_CSE_ID")


def _norm_country(country: str | None) -> str | None:
    if not country:
        return None
    c = re.sub(r"[^A-Z]", "", country.upper())
    aliases = {
        "DEU": "DE", "GERMANY": "DE", "DEUTSCHLAND": "DE",
        "UNITEDKINGDOM": "GB", "UK": "GB", "BRITAIN": "GB", "ENGLAND": "GB", "SCOTLAND": "GB", "WALES": "GB",
        "FRA": "FR", "FRANCE": "FR",
        "ESP": "ES", "SPAIN": "ES",
        "ITA": "IT", "ITALY": "IT",
        "NLD": "NL", "NETHERLANDS": "NL",
        "POL": "PL", "POLAND": "PL",
        "AUT": "AT", "AUSTRIA": "AT",
        "CHE": "CH", "SWITZERLAND": "CH",
        "BEL": "BE", "BELGIUM": "BE",
        "PRT": "PT", "PORTUGAL": "PT",
        "IRL": "IE", "IRELAND": "IE",
    }
    return aliases.get(c, c if len(c) == 2 else None)


def _is_blocklisted(host: str) -> bool:
    host = (host or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return any(host == d or host.endswith("." + d) for d in _BLOCKLIST_HOSTS)


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
def search(query: str, num: int = 5) -> list[dict]:
    key, cx = _credentials()
    if not key or not cx:
        log.warning("GOOGLE_CSE_KEY/ID not set; skipping Google CSE")
        return []
    r = requests.get(URL, params={"key": key, "cx": cx, "q": query, "num": min(num, 10)}, timeout=10)
    if r.status_code == 429:
        raise RuntimeError("Google CSE rate/quota limit")
    if r.status_code == 403:
        # Usually "Daily Limit Exceeded" or billing-not-enabled — back off silently
        log.warning("Google CSE 403 for %r (quota or billing)", query)
        return []
    if r.status_code != 200:
        log.warning("Google CSE HTTP %s for %r", r.status_code, query)
        return []
    data = r.json()
    return [
        {"title": it.get("title"), "link": it.get("link"), "snippet": it.get("snippet")}
        for it in data.get("items", []) or []
    ]


def find_company_website(name: str, country: str | None = None) -> Optional[str]:
    """Returns the site root (scheme://host) of the most likely seller-owned website,
    or None when nothing usable comes back.
    """
    name = (name or "").strip()
    if not name or len(name) < 3:
        return None
    suffixes = LEGAL_SUFFIX_BY_COUNTRY.get(_norm_country(country) or "", _DEFAULT_SUFFIXES)
    seen_hosts: set[str] = set()
    for suffix in suffixes:
        try:
            results = search(f'"{name}" {suffix}', num=5)
        except Exception:
            log.exception("Google CSE search failed for %r", name)
            return None
        for item in results:
            link = item.get("link")
            if not link:
                continue
            parsed = urlparse(link)
            host = (parsed.netloc or "").lower()
            if not host or host in seen_hosts:
                continue
            seen_hosts.add(host)
            if _is_blocklisted(host):
                continue
            return f"{parsed.scheme}://{parsed.netloc}"
    return None
