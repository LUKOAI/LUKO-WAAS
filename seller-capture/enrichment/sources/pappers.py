"""Pappers — French official company registry (INSEE/INPI/Greffes mirror). JSON, free tier.

API base:  https://api.pappers.fr/v2
Auth:      api_token query parameter (PAPPERS_API_KEY env)
Rate:      Free tier ~100 calls/day, paid tiers higher. tenacity backs off on 429.

Endpoints used:
  GET /entreprise?siren=NNNNNNNNN   → full profile + representants
  GET /recherche-entreprises?q=...  → name search (returns resultats[])

The Pappers payload is in French. We translate keys to the same shape returned by
companies_house.lookup_by_number so pipeline.py can treat them interchangeably.

Output shape (lookup_by_siren):
  {
    'company_name': str, 'company_number': str, 'legal_form': str | None,
    'status': str | None,
    'address': str | None, 'country': str | None,
    'incorporated_on': str | None,
    'officers': [
        {'name': str, 'role': str | None,
         'appointed_on': str | None, 'resigned_on': str | None,
         'nationality': str | None}, ...
    ],
    'source': 'pappers',
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

BASE = "https://api.pappers.fr/v2"
SIREN_RE = re.compile(r"^\d{9}$")
SIRET_RE = re.compile(r"^\d{14}$")
# FR VAT format: FR + 2 check chars + 9-digit SIREN
FR_VAT_RE = re.compile(r"^FR[A-Z0-9]{2}(\d{9})$")


def _api_key() -> Optional[str]:
    return os.environ.get("PAPPERS_API_KEY")


def siren_from_vat(vat: str | None) -> Optional[str]:
    if not vat:
        return None
    cleaned = re.sub(r"\s", "", vat).upper()
    m = FR_VAT_RE.match(cleaned)
    return m.group(1) if m else None


def _normalize_siren(raw: str | None) -> Optional[str]:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if SIREN_RE.match(digits):
        return digits
    if SIRET_RE.match(digits):
        return digits[:9]  # SIREN is the first 9 of a SIRET
    return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def _get(path: str, params: dict) -> Optional[dict]:
    key = _api_key()
    if not key:
        log.warning("PAPPERS_API_KEY not set; skipping Pappers")
        return None
    full = {"api_token": key, **params}
    r = requests.get(f"{BASE}{path}", params=full, timeout=15)
    if r.status_code == 404:
        return None
    if r.status_code == 429:
        raise RuntimeError("Pappers rate limit")
    if r.status_code != 200:
        log.warning("Pappers HTTP %s for %s", r.status_code, path)
        return None
    return r.json()


def _fmt_address(siege: dict | None) -> Optional[str]:
    if not siege:
        return None
    parts = [
        siege.get("adresse_ligne_1"),
        siege.get("adresse_ligne_2"),
        " ".join(p for p in (siege.get("code_postal"), siege.get("ville")) if p) or None,
        siege.get("pays"),
    ]
    return ", ".join(p for p in parts if p) or None


def _representant_name(rep: dict) -> Optional[str]:
    # individuals carry 'nom_complet'; corporate representatives carry 'denomination'
    return (rep.get("nom_complet") or rep.get("denomination") or "").strip() or None


def _normalize_profile(data: dict) -> Optional[dict]:
    if not data or not data.get("siren"):
        return None
    representants = data.get("representants") or []
    officers = []
    for rep in representants:
        if rep.get("date_fin_mandat"):  # term ended
            continue
        name = _representant_name(rep)
        if not name:
            continue
        officers.append({
            "name": name,
            "role": rep.get("qualite") or None,
            "appointed_on": rep.get("date_prise_de_poste") or rep.get("date_debut_mandat"),
            "resigned_on": rep.get("date_fin_mandat"),
            "nationality": rep.get("nationalite") or None,
        })

    siege = data.get("siege") or data.get("siege_social") or {}
    return {
        "company_name": (data.get("nom_entreprise") or data.get("denomination") or "").strip() or None,
        "company_number": data.get("siren"),
        "legal_form": (data.get("forme_juridique") or "").strip() or None,
        "status": (data.get("statut_rcs") or data.get("etat_administratif") or "").strip() or None,
        "address": _fmt_address(siege),
        "country": (siege.get("pays") or "France").strip() or None,
        "incorporated_on": data.get("date_creation"),
        "officers": officers,
        "source": "pappers",
    }


def lookup_by_siren(siren: str) -> Optional[dict]:
    norm = _normalize_siren(siren)
    if not norm:
        return None
    data = _get("/entreprise", {"siren": norm})
    return _normalize_profile(data) if data else None


def lookup_by_vat(vat: str) -> Optional[dict]:
    siren = siren_from_vat(vat)
    return lookup_by_siren(siren) if siren else None


def search_by_name(name: str, per_page: int = 5) -> list[dict]:
    if not name or not name.strip():
        return []
    resp = _get("/recherche-entreprises", {"q": name, "par_page": per_page})
    if not resp:
        return []
    out = []
    for it in resp.get("resultats") or []:
        out.append({
            "company_name": (it.get("nom_entreprise") or it.get("denomination") or "").strip() or None,
            "company_number": it.get("siren"),
            "status": it.get("statut_rcs") or it.get("etat_administratif"),
            "incorporated_on": it.get("date_creation"),
        })
    return out
