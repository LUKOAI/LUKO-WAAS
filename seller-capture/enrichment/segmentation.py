"""Jurisdiction segmentation + DE-operating signals + outreach priority.

Outreach targeting (per business decision, May 2026):
  - PL-resident sellers       → skip outright (data already available elsewhere)
  - DE-resident sellers       → enrich, but mark outreach_priority='inactive'
                                (kept warm; activated later via OUTREACH_DE_ENABLED feature flag)
  - foreign sellers           → primary target; priority depends on DE-operating signals
                                (VAT-DE / WEEE / LUCID / FBA-DE)
"""
from __future__ import annotations

import re
from typing import Optional

from .models import SellerInput, EnrichmentResult


_DE_COUNTRY_TOKENS = {"DE", "DEU", "GER", "GERMANY", "DEUTSCHLAND", "ALLEMAGNE"}
_PL_COUNTRY_TOKENS = {"PL", "POL", "POLAND", "POLSKA"}

# WEEE-Reg.-Nr. DE 12345678 (with variations in spacing / punctuation)
_WEEE_RE = re.compile(r"WEEE[\s\-]*Reg\.?[\s\-]*Nr\.?[\s\-]*DE[\s\-]*(\d{8})", re.IGNORECASE)
# LUCID Verpackungsregister: DE followed by 13 digits
_LUCID_RE = re.compile(r"\bDE\d{13}\b")
# "Versand durch Amazon" / "Fulfilled by Amazon" / "FBA"
_FBA_RE = re.compile(r"(versand\s+durch\s+amazon|fulfilled\s+by\s+amazon|\bFBA\b)", re.IGNORECASE)


def _norm_country(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return re.sub(r"[^A-Z]", "", value.upper())


def _vat_prefix(vat: Optional[str]) -> Optional[str]:
    if not vat:
        return None
    v = re.sub(r"\s", "", vat).upper()
    return v[:2] if len(v) >= 2 and v[:2].isalpha() else None


def classify_jurisdiction(s: SellerInput, vies_country: Optional[str] = None) -> tuple[str, str]:
    """Returns (segment, reason). segment ∈ {'DE','PL','foreign','unknown'}.

    Country of incorporation is the truth signal. VAT prefix is a fallback only —
    a Chinese seller can hold a DE VAT through a fiscal representative and is still 'foreign'.
    """
    country_norm = _norm_country(vies_country) or _norm_country(s.country)
    vat_pfx = _vat_prefix(s.vat)

    if country_norm:
        if country_norm in _DE_COUNTRY_TOKENS:
            return "DE", f"country={country_norm}"
        if country_norm in _PL_COUNTRY_TOKENS:
            return "PL", f"country={country_norm}"
        return "foreign", f"country={country_norm}"

    if vat_pfx == "DE":
        return "DE", "vat_prefix=DE (no country)"
    if vat_pfx == "PL":
        return "PL", "vat_prefix=PL (no country)"
    if vat_pfx:
        return "foreign", f"vat_prefix={vat_pfx} (no country)"

    return "unknown", "no country, no vat"


def extract_de_signals(s: SellerInput, r: EnrichmentResult) -> tuple[list[str], Optional[str], Optional[str]]:
    """Scans raw Amazon text fields for WEEE / LUCID / FBA markers + VAT-DE on the result.
    Returns (signals_list, weee_number, lucid_id).
    """
    signals: list[str] = []
    weee_number: Optional[str] = None
    lucid_id: Optional[str] = None

    vat = (r.vat or s.vat or "").upper().replace(" ", "")
    if vat.startswith("DE"):
        signals.append("vat_de")

    haystack_parts = [s.raw_text or "", s.gpsr_raw or "", s.business_address or "", s.business_name or ""]
    haystack = "\n".join(p for p in haystack_parts if p)

    if haystack:
        m = _WEEE_RE.search(haystack)
        if m:
            weee_number = m.group(1)
            signals.append("weee")

        m = _LUCID_RE.search(haystack)
        if m:
            lucid_id = m.group(0)
            signals.append("lucid")

        if _FBA_RE.search(haystack):
            signals.append("fba_de")

    return signals, weee_number, lucid_id


def decide_outreach_priority(segment: str, de_signals: list[str], has_contact: bool) -> str:
    """Mapping from jurisdiction × signals × contact availability → outreach priority.

    Note: weak-DE-signal foreigners ARE in scope (likely small / dropshippers who need
    SitePatron more than established ones). We still differentiate priority so the worklist
    can be sorted.
    """
    if segment == "PL":
        return "skip"
    if segment == "DE":
        return "inactive"  # gated by OUTREACH_DE_ENABLED in worklist layer
    if segment == "foreign":
        if not has_contact:
            return "review"  # foreign but no email/phone yet → manual review
        return "high" if de_signals else "medium"
    return "review"
