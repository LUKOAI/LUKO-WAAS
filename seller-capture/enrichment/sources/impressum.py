"""Generic legal-notice scraper.

EU sellers (and any seller targeting amazon.de) are required by §5 TMG to publish an
Impressum / Mentions légales / Aviso legal / Legal notice page with company name,
representative ("Vertreten durch", "Geschäftsführer", ...), address, email, phone.
This module:

1. Tries a list of common paths on the seed domain (/impressum, /imprint, ...).
2. If none of those return content, falls back to fetching `/` and scraping for an
   anchor whose visible text matches a known legal-notice label.
3. Parses the legal-notice page for emails, phones, an address block, and one or more
   officers (name + role).

We deliberately keep the parser regex-based and dependency-light — selectolax for HTML
to text, phonenumbers for phone normalisation, email-validator for filtering. No
headless browser; JS-only sites are out of scope here (eBay / Kaufland get dedicated
scrapers in other modules).

Output shape:
  {
    'emails': [str, ...],
    'phones': [str, ...],          # E.164 where possible, otherwise raw
    'officers': [{'name': str, 'role': str | None}, ...],
    'address': str | None,
    'company_name': str | None,    # often the first line under Impressum
    'source_url': str,             # the actual URL that yielded the result
  }
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

import phonenumbers
import requests
from email_validator import validate_email, EmailNotValidError
from selectolax.parser import HTMLParser
from tenacity import retry, stop_after_attempt, wait_exponential

log = logging.getLogger(__name__)

UA = "Mozilla/5.0 (compatible; LukoSellerEnrichment/1.0; +https://luko.ai)"

# Ordered by hit-rate on amazon-targeting EU sellers
COMMON_PATHS = [
    "/impressum", "/impressum/", "/imprint", "/legal-notice", "/legal",
    "/kontakt", "/contact", "/contact-us", "/contact-us/",
    "/mentions-legales", "/mentions-legales/",
    "/aviso-legal", "/aviso-legal/",
    "/informazioni-legali", "/note-legali",
    "/about/legal", "/site/legal",
]

# Anchor text patterns when probing the homepage
LEGAL_ANCHOR_RE = re.compile(
    r"\b(impressum|imprint|legal\s*notice|legal\s*info|mentions\s*l[ée]gales|"
    r"aviso\s*legal|informazioni\s*legali|note\s*legali|kontakt|contact)\b",
    re.IGNORECASE,
)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Phone matcher tuned for european impressum patterns. phonenumbers does the final validation.
PHONE_RAW_RE = re.compile(r"(?:\+|00)\s?\d[\d\s().\-]{6,}\d")

OFFICER_ROLE_PATTERNS = [
    # German
    (re.compile(r"Vertreten\s+durch[^:\n]*:\s*(?P<role>(?:Gesch[äa]ftsf[üu]hrer(?:in)?|Inhaber(?:in)?|Vorstand))?\s*[:\-]?\s*(?P<name>[A-ZÄÖÜ][\w\s.,\-äöüÄÖÜß]{2,80}?)(?=\n|\s{2,}|<)", re.IGNORECASE), "Geschäftsführer"),
    (re.compile(r"Gesch[äa]ftsf[üu]hrer(?:in)?\s*[:\-]\s*(?P<name>[A-ZÄÖÜ][\w\s.,\-äöüÄÖÜß]{2,80}?)(?=\n|\s{2,}|<)"), "Geschäftsführer"),
    (re.compile(r"Inhaber(?:in)?\s*[:\-]\s*(?P<name>[A-ZÄÖÜ][\w\s.,\-äöüÄÖÜß]{2,80}?)(?=\n|\s{2,}|<)"), "Inhaber"),
    (re.compile(r"Verantwortlich(?:e[rn])?\s+(?:i\.S\.d\.)?[^:\n]*:\s*(?P<name>[A-ZÄÖÜ][\w\s.,\-äöüÄÖÜß]{2,80}?)(?=\n|\s{2,}|<)"), "Verantwortlich"),
    (re.compile(r"Vorstand\s*[:\-]\s*(?P<name>[A-ZÄÖÜ][\w\s.,\-äöüÄÖÜß]{2,80}?)(?=\n|\s{2,}|<)"), "Vorstand"),
    # English
    (re.compile(r"\b(?:CEO|Managing Director|Director|Owner|Founder)\s*[:\-]\s*(?P<name>[A-Z][\w\s.,\-]{2,80}?)(?=\n|\s{2,}|<)"), "Director"),
    # French
    (re.compile(r"Directeur(?:\s+g[ée]n[ée]ral)?\s*[:\-]\s*(?P<name>[A-Z][\w\s.,\-éèàâêîôûïü]{2,80}?)(?=\n|\s{2,}|<)", re.IGNORECASE), "Directeur"),
    # Italian
    (re.compile(r"Amministratore(?:\s+unico|\s+delegato)?\s*[:\-]\s*(?P<name>[A-Z][\w\s.,\-]{2,80}?)(?=\n|\s{2,}|<)", re.IGNORECASE), "Amministratore"),
]


def _normalize_seed(url: str) -> Optional[str]:
    if not url:
        return None
    u = url.strip()
    if not u:
        return None
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    parsed = urlparse(u)
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
def _fetch(url: str) -> Optional[str]:
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": UA, "Accept": "text/html"})
    except requests.RequestException as exc:
        log.info("impressum fetch error %s: %s", url, exc)
        return None
    if r.status_code >= 500:
        raise RuntimeError(f"transient {r.status_code} on {url}")
    if r.status_code != 200:
        return None
    ctype = r.headers.get("content-type", "").lower()
    if "html" not in ctype and "xml" not in ctype:
        return None
    return r.text


def _find_legal_link(html: str, base: str) -> Optional[str]:
    """Scan the homepage for an anchor whose text looks like a legal-notice link."""
    try:
        doc = HTMLParser(html)
    except Exception:
        return None
    for a in doc.css("a"):
        href = (a.attributes.get("href") or "").strip()
        text = (a.text() or "").strip()
        if not href:
            continue
        if LEGAL_ANCHOR_RE.search(text) or LEGAL_ANCHOR_RE.search(href):
            return urljoin(base, href)
    return None


def _html_to_text(html: str) -> str:
    try:
        doc = HTMLParser(html)
        for s in doc.css("script, style, noscript, svg"):
            s.decompose()
        text = doc.body.text(separator="\n") if doc.body else doc.text()
    except Exception:
        return ""
    # collapse whitespace runs but preserve line breaks (helps the officer regexes)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_emails(text: str) -> list[str]:
    seen = []
    for m in EMAIL_RE.finditer(text):
        candidate = m.group(0).lower().rstrip(".,;:)")
        if candidate in seen:
            continue
        try:
            validate_email(candidate, check_deliverability=False)
        except EmailNotValidError:
            continue
        # ignore image / asset hashes (some sites obfuscate emails into pseudo-addresses)
        if candidate.endswith(("@example.com", "@email.com", "@domain.com")):
            continue
        seen.append(candidate)
    return seen


def _extract_phones(text: str, default_region: str | None = None) -> list[str]:
    out = []
    seen = set()
    # phonenumbers can sweep raw text — leverage that for better recall
    for match in phonenumbers.PhoneNumberMatcher(text, default_region):
        num = match.number
        if not phonenumbers.is_valid_number(num):
            continue
        e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
        if e164 in seen:
            continue
        seen.add(e164)
        out.append(e164)
    # fallback for international-looking numbers that the matcher missed (rare)
    for m in PHONE_RAW_RE.finditer(text):
        raw = m.group(0)
        try:
            num = phonenumbers.parse(raw, None)
        except phonenumbers.NumberParseException:
            continue
        if not phonenumbers.is_valid_number(num):
            continue
        e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
        if e164 not in seen:
            seen.add(e164)
            out.append(e164)
    return out


def _extract_officers(text: str) -> list[dict]:
    out = []
    seen_names = set()
    for pattern, default_role in OFFICER_ROLE_PATTERNS:
        for m in pattern.finditer(text):
            try:
                name = m.group("name")
            except IndexError:
                continue
            name = re.sub(r"\s+", " ", (name or "")).strip(" .,-")
            if not name or len(name) < 4 or name.lower() in seen_names:
                continue
            # quick sanity: a real name has at least one space (first + last)
            if " " not in name:
                continue
            role = None
            try:
                role = m.group("role")
            except IndexError:
                pass
            role = role.strip() if role else default_role
            out.append({"name": name, "role": role})
            seen_names.add(name.lower())
    return out


def _country_to_region(country: str | None) -> str | None:
    if not country:
        return None
    c = re.sub(r"[^A-Z]", "", country.upper())
    map_ = {
        "DE": "DE", "DEU": "DE", "GERMANY": "DE",
        "GB": "GB", "UK": "GB", "UNITEDKINGDOM": "GB",
        "FR": "FR", "FRA": "FR", "FRANCE": "FR",
        "IT": "IT", "ITA": "IT", "ITALY": "IT",
        "ES": "ES", "ESP": "ES", "SPAIN": "ES",
        "NL": "NL", "NLD": "NL", "NETHERLANDS": "NL",
        "PL": "PL", "POL": "PL", "POLAND": "PL",
        "CN": "CN", "CHN": "CN", "CHINA": "CN",
        "US": "US", "USA": "US",
    }
    return map_.get(c)


def lookup(seed_url: str, country_hint: str | None = None) -> Optional[dict]:
    """Best-effort impressum scrape from a seed URL.

    Strategy: probe COMMON_PATHS in order, return first page that yields ≥1 email or ≥1 phone
    or ≥1 officer; otherwise fetch / and follow the first legal-anchor link.
    """
    base = _normalize_seed(seed_url)
    if not base:
        return None
    region = _country_to_region(country_hint)

    def _try(url: str) -> Optional[dict]:
        html = _fetch(url)
        if not html:
            return None
        text = _html_to_text(html)
        if not text:
            return None
        emails = _extract_emails(text)
        phones = _extract_phones(text, default_region=region)
        officers = _extract_officers(text)
        if not (emails or phones or officers):
            return None
        return {
            "emails": emails,
            "phones": phones,
            "officers": officers,
            "address": None,  # leave structured-address extraction to LLM merge later
            "company_name": None,
            "source_url": url,
        }

    for path in COMMON_PATHS:
        hit = _try(base + path)
        if hit:
            return hit

    # Fallback: parse homepage, follow legal-anchor link
    home = _fetch(base + "/")
    if not home:
        return None
    link = _find_legal_link(home, base)
    if not link:
        return None
    return _try(link)
