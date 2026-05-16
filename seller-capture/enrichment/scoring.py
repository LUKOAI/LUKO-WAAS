from __future__ import annotations

import re
from .models import Contact, EnrichmentResult

GENERIC_LOCALPARTS = {
    "info", "office", "kontakt", "contact", "hello", "hi", "support", "help",
    "service", "customer", "customerservice", "kundenservice", "kundendienst",
    "sales", "verkauf", "noreply", "no-reply", "mail", "post", "admin",
    "buchhaltung", "billing", "invoice", "shop", "store", "amazon",
}
EXECUTIVE_ROLES_RE = re.compile(
    r"\b(ceo|cfo|cto|coo|cmo|founder|co-founder|owner|inhaber|gesch[äa]ftsf[üu]hrer|"
    r"managing director|director|head of (marketing|sales|growth)|vp|president|"
    r"prezes|wła[śs]ciciel|dyrektor|kierownik|gerente|directeur)\b",
    re.IGNORECASE,
)


def classify_email(value: str) -> str:
    if not value or "@" not in value:
        return "unknown"
    local = value.split("@", 1)[0].lower()
    if local in GENERIC_LOCALPARTS:
        return "generic"
    if "." in local and len(local.split(".")) == 2:
        a, b = local.split(".")
        if len(a) >= 2 and len(b) >= 2 and a.isalpha() and b.isalpha():
            return "personal"
    if any(g in local for g in ("support", "info", "service", "help", "customer", "kunden", "noreply")):
        return "generic"
    return "unknown"


def score_candidate(c: Contact, r: EnrichmentResult) -> int:
    score = 0
    src = (c.source or "").lower()
    if src.startswith("impressum:"):
        score += 60
    elif src in ("companies_house", "krs", "handelsregister", "pappers", "vies"):
        score += 70
    elif src.startswith("website:"):
        score += 40
    elif src in ("amazon_raw",):
        score += 30
    elif src in ("lucid", "ear_de", "bdo_pl"):
        score += 55

    if c.kind == "email":
        label = c.label or classify_email(c.value)
        if label == "personal":
            score += 30
        elif label == "executive":
            score += 40
        elif label == "generic":
            score -= 40

    if c.role and EXECUTIVE_ROLES_RE.search(c.role):
        score += 25

    if c.person_name and r.officers:
        names = {o.get("name", "").lower() for o in r.officers}
        if c.person_name.lower() in names:
            score += 20

    if r.agency_flag and src in ("amazon_raw",):
        score -= 50

    return max(0, min(100, score))


def compute_overall(r: EnrichmentResult) -> int:
    c = r.confidence or {}
    parts = []
    if c.get("company"):
        parts.append(c["company"] * 0.4)
    if c.get("email"):
        parts.append(c["email"] * 0.35)
    if c.get("phone"):
        parts.append(c["phone"] * 0.25)
    overall = int(sum(parts)) if parts else 0

    # Floor lift for registry-confirmed decision-makers. The weighted formula
    # above is driven by company/email/phone scores and a capture-stage
    # company_name + CH-sourced officer ends up at ~20 — operator-misleading,
    # because we DO have a named director from an authoritative source.
    # When DM name came from Companies House / Pappers / impressum, raise the
    # overall floor to 65 so the row surfaces as a real candidate.
    registry_dm_sources = ("companies_house", "pappers", "impressum")
    if r.decision_maker_name:
        dm_src = (r.sources or {}).get("decision_maker_name", "") or ""
        if any(dm_src == s or dm_src.startswith(s + ":") for s in registry_dm_sources):
            overall = max(overall, 65)

    return overall
