"""Brave Search API — used as a last-ditch website finder.

When the Amazon-side raw text doesn't carry the seller's own URL, we fall back to:
  query = "<company_name> impressum"  (or mentions-legales for FR, aviso-legal for ES, ...)
The first result whose host isn't Amazon / social / a marketplace is treated as the
seller's website and handed off to impressum.lookup().

Replaces google_cse.py — Google deprecated "Search the entire web" for new
Programmable Search Engines (Jan 2026), so Brave is the working free-tier
alternative. Drop-in compatible: same `find_company_website(name, country)` signature.

API:
  https://api.search.brave.com/res/v1/web/search?q=...&count=...
Auth:
  BRAVE_API_KEY  (subscription token, header X-Subscription-Token)
Quota:
  Data for AI Free plan: $5 credit/month renews automatically — ~1000 queries free.
  Capacity: 50 req/sec. After credit exhausts: $5 per 1000 queries.
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

URL = "https://api.search.brave.com/res/v1/web/search"

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
def search(query: str, num: int = 5, country: str | None = None) -> list[dict]:
    key = os.environ.get("BRAVE_API_KEY")
    if not key:
        log.warning("BRAVE_API_KEY not set; skipping Brave search")
        return []
    params: dict = {"q": query, "count": min(max(int(num), 1), 20)}
    cc = _norm_country(country)
    if cc:
        params["country"] = cc.lower()
    headers = {"X-Subscription-Token": key, "Accept": "application/json"}
    r = requests.get(URL, headers=headers, params=params, timeout=10)
    if r.status_code == 429:
        raise RuntimeError("Brave rate/quota limit")
    if r.status_code == 401:
        log.warning("Brave 401 — invalid BRAVE_API_KEY")
        return []
    if r.status_code == 402:
        log.warning("Brave 402 — credit exhausted for current month")
        return []
    if r.status_code != 200:
        log.warning("Brave HTTP %s for %r", r.status_code, query)
        return []
    data = r.json()
    web_results = (data.get("web") or {}).get("results") or []
    return [
        {"title": it.get("title"), "link": it.get("url"), "snippet": it.get("description")}
        for it in web_results
    ]


# Legal-form / corporate suffix tokens we strip when computing a brand slug.
# These appear inside company names but never inside the brand's own domain.
_LEGAL_FORM_TOKENS = {
    "limited", "ltd", "ltda", "gmbh", "ag", "sa", "sarl", "srl", "spa",
    "plc", "inc", "llc", "co", "company", "corporation", "corp",
    "kg", "ohg", "ug", "ek", "bv", "nv", "oy", "ab",
    "the", "and", "&",
}
# Things commonly attached to brand names that aren't part of the brand itself.
_GEO_TOKENS = {
    "uk", "u.k.", "ireland", "deutschland", "germany", "europe", "eu",
    "international", "global", "group", "holdings", "world", "worldwide",
    # Chinese city prefixes commonly stamped onto CN seller names by
    # registration/regulatory copy; they crowd out the actual brand token.
    "shenzhen", "guangzhou", "shanghai", "beijing", "dongguan", "ningbo",
    "hangzhou", "xiamen", "fuzhou", "hong", "kong", "hk",
    # Other regional cities
    "munich", "munchen", "berlin", "hamburg", "london", "paris", "madrid",
}


def _slug_from_name(name: str) -> str | None:
    """First brand-meaningful token of `name`, lowercase, alnum-only.

    Used to score Brave results: when the seller is "ANKER SOLIX TECHNOLOGY
    (UK) LTD" the slug is "anker" — so anker.com beats marketscreener.com
    even when Brave ranked the latter higher for the "impressum" query.
    Returns None when no meaningful token is left after stripping legal forms.
    """
    if not name:
        return None
    # split on non-alnum, lowercase
    tokens = re.split(r"[^A-Za-z0-9]+", name.lower())
    for tok in tokens:
        if not tok:
            continue
        if tok in _LEGAL_FORM_TOKENS or tok in _GEO_TOKENS:
            continue
        if len(tok) < 4:
            # short tokens are usually noise (acronyms, articles); keep
            # scanning. Exception: a 3-letter token is fine if it's the
            # only meaningful one we'd otherwise return below.
            continue
        return tok
    # fallback: first 3+-letter token regardless of length floor
    for tok in tokens:
        if tok and tok not in _LEGAL_FORM_TOKENS and tok not in _GEO_TOKENS and len(tok) >= 3:
            return tok
    return None


def _brand_query_tokens(name: str) -> str | None:
    """Strip legal-form / geo tokens from `name` and return the brand-only
    fragment for use as a search query (instead of the full corporate name,
    which biases Brave toward register pages).

    Example:
      "ANKER SOLIX TECHNOLOGY (UK) LTD" -> "anker solix technology"
      "MOLETA MUNRO LTD"                -> "moleta munro"
    """
    if not name:
        return None
    tokens = re.split(r"[^A-Za-z0-9]+", name.lower())
    keep = [t for t in tokens if t and t not in _LEGAL_FORM_TOKENS and t not in _GEO_TOKENS]
    if not keep:
        return None
    # Cap at 2 tokens: the brand itself plus an optional qualifier
    # ("anker solix", "moleta munro"). More tokens add descriptor words
    # ("technology", "innovations") that confuse Brave's relevance ranking
    # and surface review/generic articles instead of the brand site.
    return " ".join(keep[:2])


def find_company_website(name: str, country: str | None = None) -> Optional[str]:
    """Returns the site root (scheme://host) of the most likely seller-owned website,
    or None when nothing usable comes back. Drop-in replacement for
    google_cse.find_company_website.

    Strategy:
      Q1 — search for the brand-only query (slug + remaining brand tokens) so
           Brave is biased toward the actual company site instead of the
           Companies House / Pappers register page for the formal name.
      Q2 — fall back to the formal-name + legal-notice variants (legacy).

      Across both query result sets, two-tier ranking:
        1. Prefer non-blocklisted hosts whose base domain contains the brand
           slug (anker.com beats marketscreener.com for "Anker Innovations").
        2. Otherwise fall back to the first non-blocklisted result.
    """
    name = (name or "").strip()
    if not name or len(name) < 3:
        return None
    slug = _slug_from_name(name)
    brand_q = _brand_query_tokens(name)
    suffixes = LEGAL_SUFFIX_BY_COUNTRY.get(_norm_country(country) or "", _DEFAULT_SUFFIXES)

    # Compose query plan: brand-only query first (no suffix), then the legacy
    # quoted-formal-name + impressum/legal-notice variants.
    queries: list[str] = []
    if brand_q and brand_q.lower() != name.lower():
        queries.append(brand_q)
    for suffix in suffixes:
        queries.append(f'"{name}" {suffix}')

    seen_hosts: set[str] = set()
    ordered_candidates: list[tuple[str, str]] = []  # (host, scheme://netloc)
    for q in queries:
        try:
            results = search(q, num=5, country=country)
        except Exception:
            log.exception("Brave search failed for %r", q)
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
            ordered_candidates.append((host, f"{parsed.scheme}://{parsed.netloc}"))

    if not ordered_candidates:
        return None

    # Tier 1: slug-match wins, even if it's not the top-ranked Brave result.
    if slug:
        for host, url in ordered_candidates:
            base = (host[4:] if host.startswith("www.") else host).split(".")[0]
            # slug "anker" hits anker.com / anker-uk.co.uk / ankersolix.com
            if slug in base or base in slug:
                return url

    # Tier 2: legacy first-non-blocklisted fallback.
    return ordered_candidates[0][1]
