from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SellerInput:
    seller_id: str
    marketplace: Optional[str] = None
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    country: Optional[str] = None
    vat: Optional[str] = None
    registry_id: Optional[str] = None
    phone_raw: Optional[str] = None
    email_raw: Optional[str] = None


@dataclass
class Contact:
    """One candidate contact (email or phone), with provenance."""
    kind: str                  # 'email' | 'phone'
    value: str
    label: Optional[str] = None        # 'support' | 'info' | 'personal' | 'executive' | 'unknown'
    person_name: Optional[str] = None
    role: Optional[str] = None
    source: str = ""           # 'vies' | 'lucid' | 'impressum:<url>' | ...
    score: int = 0


@dataclass
class EnrichmentResult:
    seller_id: str
    # Identity (post-merge truth)
    company_name: Optional[str] = None
    legal_form: Optional[str] = None
    business_address: Optional[str] = None
    country: Optional[str] = None
    vat: Optional[str] = None
    registry_id: Optional[str] = None
    # Web
    website: Optional[str] = None
    other_urls: list[str] = field(default_factory=list)
    tech_stack: list[str] = field(default_factory=list)
    brands: list[str] = field(default_factory=list)
    other_marketplaces: list[dict] = field(default_factory=list)
    # Officers / decision-makers
    officers: list[dict] = field(default_factory=list)
    decision_maker_name: Optional[str] = None
    decision_maker_role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    # All candidates
    candidates: list[Contact] = field(default_factory=list)
    generic_contacts: list[dict] = field(default_factory=list)
    # Negatives
    agency_flag: Optional[str] = None
    # Scoring
    confidence: dict = field(default_factory=dict)
    sources: dict = field(default_factory=dict)
    status: str = "enriched_failed"
