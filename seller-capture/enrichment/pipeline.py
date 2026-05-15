"""High-level enrichment pipeline. Sources are called in a strict order:
truth-anchored registries first, then web, then cross-platform, then LLM merge.
"""
from __future__ import annotations

import logging

from .models import SellerInput, EnrichmentResult
from .sources import vies
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

    # 2-N) TODO: companies_house, krs (PL — only if we ever re-enable), handelsregister (idem),
    #            pappers, ear_de, lucid_de, impressum, ebay, kaufland, allegro, otto, llm_merge.
    #            Wire each source like above; each returns a dict + appends candidates to r.candidates.

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
