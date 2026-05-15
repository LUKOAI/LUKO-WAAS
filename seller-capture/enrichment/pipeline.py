"""High-level enrichment pipeline. Sources are called in a strict order:
truth-anchored registries first, then web, then cross-platform, then LLM merge.
"""
from __future__ import annotations

import logging
import re

from .models import SellerInput, EnrichmentResult
from .sources import vies, companies_house
from .scoring import score_candidate, compute_overall
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


def _is_uk(country: str | None, vat: str | None) -> bool:
    c = re.sub(r"[^A-Z]", "", (country or "").upper())
    if c in _UK_COUNTRY_TOKENS:
        return True
    v = re.sub(r"\s", "", (vat or "").upper())
    return v.startswith("GB")


def _companies_house_lookup(s: SellerInput, r: EnrichmentResult) -> dict | None:
    """Try Companies House by company number first; if that fails, fall back to an
    exact name match (case-insensitive). Fuzzy multi-candidate matches are intentionally
    discarded — wrong officer data is worse than no officer data.
    """
    # 1) by number — registry_id from Amazon, or anything that looks like a CH number
    for raw in (s.registry_id, r.registry_id):
        if not raw:
            continue
        try:
            data = companies_house.lookup_by_number(raw)
            if data:
                return data
        except Exception:
            log.exception("CH lookup_by_number failed for %s", raw)

    # 2) by name — exact match only
    name = (r.company_name or s.business_name or "").strip()
    if not name:
        return None
    try:
        candidates = companies_house.search_by_name(name, items_per_page=10)
    except Exception:
        log.exception("CH search_by_name failed for %s", name)
        return None
    exact = [c for c in candidates if (c.get("company_name") or "").strip().lower() == name.lower()]
    if len(exact) != 1 or not exact[0].get("company_number"):
        return None
    try:
        return companies_house.lookup_by_number(exact[0]["company_number"])
    except Exception:
        log.exception("CH lookup_by_number (after name match) failed for %s", exact[0])
        return None


def _merge_companies_house(d: dict, r: EnrichmentResult) -> None:
    """Companies House is high-trust for identity (90), but never overrides VIES (95)."""
    if d.get("company_name") and not r.company_name:
        r.company_name = d["company_name"]
        r.confidence["company"] = max(r.confidence.get("company", 0), 90)
        r.sources["company_name"] = "companies_house"
    if d.get("legal_form") and not r.legal_form:
        r.legal_form = d["legal_form"]
        r.sources["legal_form"] = "companies_house"
    if d.get("address") and not r.business_address:
        r.business_address = d["address"]
        r.sources["business_address"] = "companies_house"
    if d.get("country") and not r.country:
        r.country = d["country"]
    if d.get("company_number") and not r.registry_id:
        r.registry_id = d["company_number"]
        r.sources["registry_id"] = "companies_house"
    if d.get("officers"):
        r.officers = d["officers"]
        r.sources["officers"] = "companies_house"
    if d.get("status") == "dissolved":
        # dissolved companies are a hard kill for outreach
        r.agency_flag = (r.agency_flag or "") + ("|" if r.agency_flag else "") + "dissolved"


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

    # 2) Companies House — UK official registry (free, JSON). UK is a high-density foreign segment.
    if _is_uk(vies_country or s.country, s.vat):
        ch_data = _companies_house_lookup(s, r)
        if ch_data:
            _merge_companies_house(ch_data, r)

    # 3-N) TODO: pappers (FR), ear_de + lucid_de (verify foreign DE-operating signals),
    #            handelsregister + krs (only if DE/PL ever re-enabled), impressum, ebay,
    #            kaufland, allegro, otto, llm_merge.

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

    # Officer fallback: when no email gave us a person, the registry director is the next-best
    # named contact. Prefer "director" over secretaries / nominees.
    if not r.decision_maker_name and r.officers:
        directors = [o for o in r.officers if "director" in (o.get("role") or "").lower()]
        pick = (directors or r.officers)[0]
        if pick.get("name"):
            r.decision_maker_name = pick["name"]
            r.decision_maker_role = pick.get("role") or r.decision_maker_role
            r.sources.setdefault("decision_maker_name", "companies_house")

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
