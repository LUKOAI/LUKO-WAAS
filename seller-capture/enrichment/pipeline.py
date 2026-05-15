"""High-level enrichment pipeline. Sources are called in a strict order:
truth-anchored registries first, then web, then cross-platform, then LLM merge.
"""
from __future__ import annotations

import logging
import re

from urllib.parse import urlparse

from .models import SellerInput, EnrichmentResult, Contact
from .sources import vies, companies_house, pappers, impressum
from .scoring import score_candidate, compute_overall, classify_email
from .segmentation import classify_jurisdiction, extract_de_signals, decide_outreach_priority

log = logging.getLogger(__name__)


def _vat_country(vat: str | None) -> tuple[str | None, str | None]:
    if not vat:
        return None, None
    v = vat.replace(" ", "").upper()
    if len(v) >= 4 and v[:2].isalpha():
        return v[:2], v[2:]
    return None, v


_UK_COUNTRY_TOKENS = {"GB", "UK", "UNITEDKINGDOM", "BRITAIN", "ENGLAND", "SCOTLAND", "WALES", "NORTHERNIRELAND"}
_FR_COUNTRY_TOKENS = {"FR", "FRA", "FRANCE"}
# any of these substrings inside a registry's status field means "don't contact"
_INACTIVE_STATUS_HINTS = ("dissolv", "radi", "cess", "liquidation", "administration", "struck off", "ferm")


def _is_uk(country: str | None, vat: str | None) -> bool:
    c = re.sub(r"[^A-Z]", "", (country or "").upper())
    if c in _UK_COUNTRY_TOKENS:
        return True
    v = re.sub(r"\s", "", (vat or "").upper())
    return v.startswith("GB")


def _is_fr(country: str | None, vat: str | None) -> bool:
    c = re.sub(r"[^A-Z]", "", (country or "").upper())
    if c in _FR_COUNTRY_TOKENS:
        return True
    v = re.sub(r"\s", "", (vat or "").upper())
    return v.startswith("FR")


URL_RE = re.compile(r"https?://[^\s)>\"'<]+", re.IGNORECASE)
# Hosts that aren't a seller's "own" website — kept aside in other_urls instead.
_NON_WEBSITE_HOSTS = {
    "amazon.com", "amazon.de", "amazon.co.uk", "amazon.fr", "amazon.it", "amazon.es",
    "amazon.pl", "amazon.nl", "amazon.se", "amazon.ca", "amazon.com.mx", "amazon.co.jp",
    "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "linkedin.com", "tiktok.com", "pinterest.com", "snapchat.com",
    "wa.me", "t.me", "telegram.org", "telegram.me",
    "google.com", "maps.google.com", "goo.gl", "bit.ly", "tinyurl.com",
}


def _host(url: str) -> str:
    h = (urlparse(url).netloc or "").lower()
    return h[4:] if h.startswith("www.") else h


def _is_social_or_marketplace(host: str) -> bool:
    return any(host == d or host.endswith("." + d) for d in _NON_WEBSITE_HOSTS)


def _extract_website_from_text(*texts: str | None) -> tuple[str | None, list[str]]:
    """Returns (primary_website, other_urls). Primary is the first URL whose host is not
    Amazon, social media, or a known link-shortener. Others go into the bucket."""
    primary: str | None = None
    others: list[str] = []
    seen: set[str] = set()
    for txt in texts:
        if not txt:
            continue
        for m in URL_RE.finditer(txt):
            url = m.group(0).rstrip(".,;:)>\"'")
            if url in seen:
                continue
            seen.add(url)
            host = _host(url)
            if not host:
                continue
            if _is_social_or_marketplace(host):
                if not host.startswith("amazon."):
                    others.append(url)
                continue
            if primary is None:
                primary = url
            else:
                others.append(url)
    return primary, others


def _person_from_email(email: str) -> str | None:
    """Recovers a "First Last" name from 'first.last@domain' style addresses."""
    local = email.split("@", 1)[0]
    parts = local.split(".")
    if len(parts) == 2 and all(p.isalpha() and len(p) >= 2 for p in parts):
        return f"{parts[0].capitalize()} {parts[1].capitalize()}"
    return None


def _ingest_impressum(imp: dict, r: EnrichmentResult) -> None:
    """Turns impressum scrape output into Contact candidates + optional officers fill-in."""
    src_label = f"impressum:{imp.get('source_url') or r.website}"
    for e in imp.get("emails") or []:
        r.candidates.append(Contact(
            kind="email", value=e, label=None,
            person_name=_person_from_email(e), source=src_label,
        ))
    for p in imp.get("phones") or []:
        r.candidates.append(Contact(kind="phone", value=p, source=src_label))
    # Officers fill empty slots only — registry data (CH/Pappers) is more authoritative.
    if not r.officers and imp.get("officers"):
        r.officers = imp["officers"]
        r.sources["officers"] = src_label


def _is_inactive_status(status: str | None) -> bool:
    if not status:
        return False
    s = status.lower()
    if "active" in s and "inactive" not in s:
        return False
    return any(h in s for h in _INACTIVE_STATUS_HINTS)


def _registry_lookup_by_number_or_name(
    module,
    lookup_fn_name: str,
    raw_numbers: list[str | None],
    name: str | None,
) -> dict | None:
    """Generic lookup: try a list of candidate registry numbers, then fall back to an
    exact-name match. Multi-candidate matches are intentionally discarded — wrong officer
    data is worse than no officer data. `module` exposes a callable `lookup_fn_name` and
    `search_by_name`.
    """
    lookup_fn = getattr(module, lookup_fn_name)
    for raw in raw_numbers:
        if not raw:
            continue
        try:
            data = lookup_fn(raw)
            if data:
                return data
        except Exception:
            log.exception("%s %s failed for %s", module.__name__, lookup_fn_name, raw)

    name = (name or "").strip()
    if not name:
        return None
    try:
        candidates = module.search_by_name(name)
    except Exception:
        log.exception("%s search_by_name failed for %s", module.__name__, name)
        return None
    exact = [c for c in candidates if (c.get("company_name") or "").strip().lower() == name.lower()]
    if len(exact) != 1 or not exact[0].get("company_number"):
        return None
    try:
        return lookup_fn(exact[0]["company_number"])
    except Exception:
        log.exception("%s %s (post-name-match) failed for %s", module.__name__, lookup_fn_name, exact[0])
        return None


def _companies_house_lookup(s: SellerInput, r: EnrichmentResult) -> dict | None:
    return _registry_lookup_by_number_or_name(
        companies_house, "lookup_by_number",
        raw_numbers=[s.registry_id, r.registry_id],
        name=r.company_name or s.business_name,
    )


def _pappers_lookup(s: SellerInput, r: EnrichmentResult) -> dict | None:
    # FR sellers expose SIREN inside their VAT (FR{2}{9-digit SIREN}); use it as the primary key.
    siren_from_vat = pappers.siren_from_vat(s.vat) or pappers.siren_from_vat(r.vat)
    return _registry_lookup_by_number_or_name(
        pappers, "lookup_by_siren",
        raw_numbers=[siren_from_vat, s.registry_id, r.registry_id],
        name=r.company_name or s.business_name,
    )


def _merge_registry(d: dict, r: EnrichmentResult, *, trust: int = 90) -> None:
    """Fills empty slots from a registry payload (CH / Pappers / etc). Never overrides
    higher-trust prior values: VIES (95) wins over CH/Pappers (90) on company_name.
    """
    src = d.get("source") or "registry"
    if d.get("company_name") and not r.company_name:
        r.company_name = d["company_name"]
        r.confidence["company"] = max(r.confidence.get("company", 0), trust)
        r.sources["company_name"] = src
    if d.get("legal_form") and not r.legal_form:
        r.legal_form = d["legal_form"]
        r.sources["legal_form"] = src
    if d.get("address") and not r.business_address:
        r.business_address = d["address"]
        r.sources["business_address"] = src
    if d.get("country") and not r.country:
        r.country = d["country"]
    if d.get("company_number") and not r.registry_id:
        r.registry_id = d["company_number"]
        r.sources["registry_id"] = src
    if d.get("officers") and not r.officers:
        r.officers = d["officers"]
        r.sources["officers"] = src
    if _is_inactive_status(d.get("status")):
        flag = "dissolved" if "dissolv" in (d.get("status") or "").lower() else "inactive_registry"
        existing = r.agency_flag or ""
        if flag not in existing:
            r.agency_flag = (existing + "|" + flag) if existing else flag


def _skip_resident(r: EnrichmentResult, segment: str, reason: str) -> EnrichmentResult:
    """DE/PL sellers: keep them in the warehouse with raw Amazon fields for future search,
    but do NOT run further enrichment (no VIES, no scrapers, no LLM merge). Out of outreach scope.
    """
    r.jurisdiction_segment = segment
    r.jurisdiction_reason = reason
    if segment == "PL":
        r.outreach_priority = "skip"
        r.status = "skipped_pl"
    else:  # DE
        r.outreach_priority = "inactive"
        r.status = "skipped_de"
    return r


def enrich_one(s: SellerInput) -> EnrichmentResult:
    r = EnrichmentResult(seller_id=s.seller_id)
    r.country = s.country or None
    r.business_address = s.business_address or None
    r.vat = s.vat or None
    r.registry_id = s.registry_id or None
    r.sources = {}
    r.confidence = {"company": 0, "email": 0, "phone": 0}

    # Pre-segment: PL/DE residents stay in the warehouse with raw Amazon fields,
    # but skip every external lookup. Foreign + unknown fall through to enrichment.
    pre_segment, pre_reason = classify_jurisdiction(s)
    if pre_segment in ("PL", "DE"):
        return _skip_resident(r, pre_segment, pre_reason)

    # 1) VIES — VAT-anchored truth
    vies_country: str | None = None
    country, vat_body = _vat_country(s.vat)
    if country and vat_body:
        try:
            vies_res = vies.lookup(country, vat_body)
            if vies_res and vies_res.get("valid"):
                vies_country = vies_res.get("country") or country
                if vies_res.get("name"):
                    r.company_name = vies_res["name"]
                    r.confidence["company"] = max(r.confidence["company"], 95)
                    r.sources["company_name"] = "vies"
                if vies_res.get("address"):
                    r.business_address = vies_res["address"]
                    r.sources["business_address"] = "vies"
        except Exception:
            log.exception("VIES lookup failed for %s", s.vat)

    # Jurisdiction (with VIES-confirmed country if we have it).
    # VIES may reveal that a seller with empty/foreign Amazon country is actually DE/PL
    # (e.g. CN seller with DE fiscal-rep VAT — that's still 'foreign', country wins;
    # but an empty-country seller whose VIES name resolves to a German GmbH is DE).
    segment, reason = classify_jurisdiction(s, vies_country=vies_country)
    if segment in ("PL", "DE"):
        # discard any contacts we accidentally collected pre-classification
        r.candidates = []
        return _skip_resident(r, segment, reason)
    r.jurisdiction_segment = segment
    r.jurisdiction_reason = reason

    # 2) Country-specific official registries — dispatched by VIES-confirmed country / VAT prefix.
    #    UK and FR are the two highest-density foreign segments on amazon.de.
    eff_country = vies_country or s.country
    if _is_uk(eff_country, s.vat):
        ch_data = _companies_house_lookup(s, r)
        if ch_data:
            _merge_registry(ch_data, r)
    elif _is_fr(eff_country, s.vat):
        fr_data = _pappers_lookup(s, r)
        if fr_data:
            _merge_registry(fr_data, r)

    # 3) Website detection from raw Amazon text — anything that isn't Amazon / social / shortener
    #    becomes the seller's primary website (used by impressum next).
    if not r.website:
        website, other = _extract_website_from_text(s.raw_text, s.gpsr_raw, s.business_address)
        if website:
            r.website = website
            r.sources["website"] = "amazon_raw"
        for u in other:
            if u not in r.other_urls:
                r.other_urls.append(u)

    # 4) Impressum / legal-notice scraper — best-effort, fills candidates + officers.
    if r.website:
        try:
            imp = impressum.lookup(r.website, country_hint=r.country)
        except Exception:
            log.exception("impressum.lookup failed for %s", r.website)
            imp = None
        if imp:
            _ingest_impressum(imp, r)

    # 5-N) TODO: ear_de + lucid_de (verify foreign DE-operating signals), handelsregister + krs
    #            (only if DE/PL ever re-enabled), ebay, kaufland, allegro, otto, llm_merge.

    # Fallback: keep raw Amazon name if registries did not return anything.
    if not r.company_name and s.business_name:
        r.company_name = s.business_name
        r.confidence["company"] = 50
        r.sources["company_name"] = "amazon_raw"

    # DE-operating signals (raw_text / gpsr_raw harvested by extension)
    signals, weee_number, lucid_id = extract_de_signals(s, r)
    r.de_operating_signals = signals
    if weee_number:
        r.weee_number = weee_number
        r.sources["weee_number"] = "amazon_raw"
    if lucid_id:
        r.lucid_id = lucid_id
        r.sources["lucid_id"] = "amazon_raw"

    # Score remaining candidates
    for c in r.candidates:
        c.score = score_candidate(c, r)

    # Pick best email/phone (>=60 threshold)
    emails = sorted([c for c in r.candidates if c.kind == "email" and c.score >= 60], key=lambda c: c.score, reverse=True)
    phones = sorted([c for c in r.candidates if c.kind == "phone" and c.score >= 60], key=lambda c: c.score, reverse=True)
    if emails:
        best = emails[0]
        r.email = best.value
        r.decision_maker_name = best.person_name or r.decision_maker_name
        r.decision_maker_role = best.role or r.decision_maker_role
        r.confidence["email"] = best.score
        r.sources["email"] = best.source
    if phones:
        best = phones[0]
        r.phone = best.value
        r.confidence["phone"] = best.score
        r.sources["phone"] = best.source

    # If the email pick gave us a name that matches a known officer, lift their role across.
    if r.decision_maker_name and not r.decision_maker_role and r.officers:
        name_low = r.decision_maker_name.lower()
        for o in r.officers:
            if (o.get("name") or "").lower() == name_low and o.get("role"):
                r.decision_maker_role = o["role"]
                break

    # Officer fallback: when no email gave us a person, the registry director is the next-best
    # named contact. Prefer "director" / "Geschäftsführer" over secretaries / nominees.
    if not r.decision_maker_name and r.officers:
        directors = [o for o in r.officers if re.search(r"director|gesch[äa]ftsf[üu]hrer|pr[ée]sident|amministratore", (o.get("role") or ""), re.IGNORECASE)]
        pick = (directors or r.officers)[0]
        if pick.get("name"):
            r.decision_maker_name = pick["name"]
            r.decision_maker_role = pick.get("role") or r.decision_maker_role
            r.sources.setdefault("decision_maker_name", r.sources.get("officers", "registry"))

    # Generic / agency-flagged go aside
    r.generic_contacts = [
        {"kind": c.kind, "value": c.value, "label": c.label, "source": c.source, "score": c.score}
        for c in r.candidates if c.score < 60
    ]

    overall = compute_overall(r)
    r.confidence["overall"] = overall

    # Outreach priority (jurisdiction × DE signals × contact availability)
    r.outreach_priority = decide_outreach_priority(
        segment=r.jurisdiction_segment,
        de_signals=r.de_operating_signals,
        has_contact=bool(r.email or r.phone),
    )

    if r.agency_flag and not r.email and not r.phone:
        r.status = "agency_only"
    elif overall >= 70:
        r.status = "enriched_ok"
    elif overall >= 30:
        r.status = "enriched_low_confidence"
    else:
        r.status = "enriched_failed"
    return r
