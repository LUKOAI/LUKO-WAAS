"""Two-pass LLM consolidation of multi-source seller enrichment evidence.

PASS 1 — Haiku 4.5 + structured sources only (no web_search).
  Cheap (~1-2¢/seller). Runs for every seller. Consolidates whatever VIES,
  Companies House, Pappers, impressum, and Amazon raw_text gave us into a
  single decision-grade record. Must be honest about confidence — when
  signals are weak, return low confidence so PASS 2 can escalate.

PASS 2 — Sonnet 4.6 + web_search tool (agentic research).
  Expensive (~10¢/seller). Runs ONLY when PASS 1 confidence < threshold and
  no agency flag. Targets markets without free registry coverage (CN / JP /
  US / unregistered EU). Receives PASS 1's output as `prior_consolidation`
  to avoid duplicating known facts.

Orchestrator: `consolidate_2pass(sources, confidence_threshold=60)`. Returns
the same dict shape as either pass, plus `_metas` (list of per-call usage)
for cost accounting.

Env:
  ANTHROPIC_API_KEY — required; module returns None gracefully without it.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

import anthropic

log = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5"     # PASS 1: structured-data merge, no tools
SONNET_MODEL = "claude-sonnet-4-6"   # PASS 2: web_search agentic research
# PASS 1 confidence < this => escalate to PASS 2. Dropped from 60 to 50 after
# empirical mixed-batch test (2026-05-16): UK Ltd cases with CH-confirmed
# officers but no email landed at conf 35-45, all of them escalated and PASS 2
# found nothing better. The early-exit rule below (registry officer present)
# catches that subset directly; threshold 50 narrows the remaining window
# where PASS 2 still has a realistic shot at rescuing the contact.
DEFAULT_CONFIDENCE_THRESHOLD = 50

MAX_TOKENS = 4096  # output cap. Higher than legacy because Sonnet's research
                   # may include intermediate reasoning + multi-paragraph notes
                   # justifying the decision-maker pick.
PAYLOAD_CHAR_LIMIT = 200_000  # truncate huge raw-text dumps before sending

# Anthropic server-side tools enabled below give the LLM live web search and
# URL fetch capability — so it can actually go look for the CEO's email instead
# of guessing from the impressum data we passed in.
WEB_SEARCH_TOOL = {
    "type": "web_search_20250305",
    "name": "web_search",
    "max_uses": 8,  # cap searches per seller — keeps cost bounded
}

HAIKU_PASS1_PREFIX = """## CONSOLIDATION MANDATE — STRUCTURED SOURCES ONLY (PASS 1)

You have NO web_search, NO URL fetch, NO external lookups. Your only inputs
are the structured sources in the user message (VIES, Companies House,
Pappers, impressum scrape result, Amazon raw_text). Consolidate them — do
not invent or fabricate.

**Be honest with confidence.** A downstream PASS 2 will re-process every
seller you flag with `confidence < 60` using full web research. So:
  - If you have a clear officer name + matching personal email + registry
    confirmation, confidence 80-95.
  - If you have a name OR a personal email but not both, confidence 40-60.
  - If you only have generic info@ / contact@ and no named individual,
    confidence 10-25 — PASS 2 will go find the CEO.
  - If sources flag an agency / fiscal rep / GPSR representative, set
    `is_agency: true` with a clear reason — PASS 2 will NOT re-research
    (agency-flagged records are excluded from outreach regardless).

Do not pad confidence above what the structured signals actually support.
A confident-looking `info@brand.com` with no officer name is still a 20.

---

"""

RESEARCH_PROMPT_PREFIX = """## RESEARCH MANDATE (READ FIRST — PASS 2)

You may receive a `prior_consolidation` field in the user payload — that's
PASS 1's output (Haiku, structured sources only). If PASS 1 already
identified a named officer with a personal email, your job is to VERIFY
that pick via the web (does the email domain match the company's real
website? is the officer still active?). If PASS 1 returned a low-confidence
generic-email record, your job is to FIND BETTER CONTACTS via research.
If PASS 1 flagged agency, the orchestrator would not have called you — so
you can assume agency=false unless your research reveals a fresh signal.



You have a live `web_search` tool. USE IT AGGRESSIVELY. The operator-visible
output of this enrichment is only as good as the contacts you surface. A
single "info@company.com" / "amazon-eu@brand.com" / "support@" entry is
WORTHLESS for B2B outreach — those go to support tickets, not decision makers.

For every foreign-segment seller (UK / NL / US / CN / etc.), do at minimum:

1. **Find the real company website**. Search `"<company_name>" official site`
   or `<company_name> imprint`. Don't assume Amazon URL is their site.
2. **Identify executives**. Search:
     `"<company_name>" CEO`,
     `"<company_name>" Geschäftsführer`,
     `"<company_name>" director`,
     `"<company_name>" founder`,
     `"<company_name>" linkedin`,
     `"<company_name>" sales manager OR ecommerce manager OR head of marketing`.
   Names from a registry trump names from LinkedIn (which can be stale).
3. **Reach the decision maker's PERSONAL email**, not a department alias.
   - Try common patterns at the company's domain:
     `first.last@`, `first_last@`, `flast@`, `firstl@`, `first@`.
   - If their website lists a team page or imprint email, prefer that.
   - VERIFY the email's domain matches the company website domain, not a
     reseller / 3PL / Amazon storefront domain.
4. **Cross-check against eBay / other marketplaces** if the seller is also
   listed there — sometimes the contact info is fresher on the smaller
   platform.
5. **Check LUCID / EAR / national EPR registries** for German Verpackungs- or
   WEEE-registered brands; the registered point of contact may be the right
   person.
6. **Phone**: if the seller has a switchboard, search for
   `"<company_name>" +<country code>` to find direct lines published in
   trade press, press releases, sales decks (PDFs).
7. **If you can't beat "info@<domain>"**, return confidence < 30 and put a
   2-3 sentence note in `notes` explaining exactly which searches you tried
   and what the dead-ends were. Do not fabricate. Do not return a department
   alias as `email` if confidence < 50.

You may make up to 8 web searches per seller. Use them. The user is paying
for thorough research; budget is not an issue.

---

"""

SYSTEM_PROMPT_BODY = """You are a B2B contact-research analyst specialising in cross-jurisdictional
seller enrichment for the European Amazon marketplaces (primarily amazon.de).
Your job is to consolidate evidence from official company registries (VIES,
UK Companies House, French Pappers), website impressum / legal-notice scrapes,
and raw Amazon seller data into a single decision-grade record that drives
real B2B outreach.

This is not a fact-extraction task. Multiple sources will disagree, and part
of your job is to resolve the conflict.

# Your output — exactly three fields, nothing more

1. `consolidated_decision_maker` — your best single contact pick:
   - `name`: full personal name of a REAL HUMAN INDIVIDUAL (e.g. "Max
     Mustermann", "SMITH, John", "Dupont Jean"). Use the casing the source
     registry uses (UK CH yells surnames; Pappers Mixed Case; impressum
     varies). **REJECT TEAM ALIASES AND DEPARTMENT NAMES.** Forbidden values
     (return null instead):
       "Sales Team", "DTC Sales", "Sales USA", "Sales", "Support",
       "Customer Service", "Customer Care", "Info", "Contact", "Office",
       "PR", "Press", "Media", "Marketing", "HR", "Affiliate",
       "Wholesale", "Partner", "Partners", "Team", "Staff", "Admin",
       "Reviews", "Helpdesk", "Service", "Verkauf", "Vertrieb", "Kontakt",
       "Buchhaltung", "Empfang", "Réception", "Atención", "Servicio",
       "Equipo", "Vendite"
     Heuristic: if the candidate "name" contains a department/role word
     and no human first name + surname pair, it's an alias — set null
     and explain in `notes` ("found only dtc.sales@... alias, no named
     individual"). A surname like "Sales" attached to a real first name
     ("John Sales") is fine; the alias trap is the role-word standing
     in for a person.
     Null if no named individual can be identified from any source.
   - `role`: the actual role title in its native language — "Geschäftsführer",
     "director", "Président", "Directeur général", "Amministratore unico",
     "Owner", "Founder", "Inhaber", "Prokurist". Do NOT translate. Null if
     unknown.
   - `email`: the email most likely to reach this individual. Prefer
     personal addresses ("first.last@", "f.last@", "firstlast@") over
     departmental ("info@", "sales@", "support@", "kontakt@", "office@",
     "service@", "buchhaltung@", "vertrieb@"). Null if no usable email.
   - `phone`: a number in E.164 format that's most likely to reach this
     individual. Null if only switchboard / generic numbers are listed.
   - `confidence`: 0-100. How sure you are this is the right outreach target:
     - 90-100: registry-confirmed officer + personal email + matching phone
     - 70-89: registry officer with personal email OR matching phone
     - 50-69: officer name from impressum only + a personal email
     - 30-49: generic email + named individual from some source
     - 0-29: nothing better than "info@" / "contact@" and no named individual

2. `agency_flag` — does this record actually represent a regulatory agency
   acting on behalf of the real seller, rather than the seller itself?
   - `is_agency`: true if the named contact, email domain, role, or company
     name points to an external compliance / fiscal / GPSR / EPR / WEEE /
     EU representative rather than the actual seller.
   - `reason`: short string explaining the specific signal that triggered it.
     Null if not flagged.

3. `notes` — array of short strings (≤120 chars each) capturing conflicts,
   ambiguities, or operator-facing signals that don't fit the other fields.
   Empty array `[]` if nothing notable. Examples:
     "VIES name 'ACME LTD' differs from CH name 'ACME TRADING LTD'"
     "Two directors found, picked SMITH (Director) over DOE (Secretary)"
     "No phone number — outreach should be email-only"
     "Email j.dupont@acme.fr matches Pappers Président DUPONT Jean"

# What counts as an "agency"

Foreign sellers (mostly Chinese and US) frequently need EU-resident
representatives for regulatory compliance. Their impressum lists the
**representative**, not the seller. Outreach to that representative is
wasted effort — they're a third party getting paid to be the postbox.

Recognisable patterns — flag `is_agency: true` if ANY of these match:

- **GPSR Representative** (General Product Safety Regulation, EU 2023/988):
    "Authorised representative pursuant to Article 16 GPSR"
    "EU-Bevollmächtigter gemäß Artikel 16 GPSR"
    "Authorized Representative under GPSR"
    "GPSR-Bevollmächtigter"
    "Representant autorisé GPSR"

- **EU Authorised Representative for CE / EC-marked goods**:
    "EU Authorised Representative"
    "EU-AR"
    "Authorised representative for the European Union"
    "Bevollmächtigter Vertreter in der EU"

- **EPR Representative** (Extended Producer Responsibility):
    Company names containing "EPR", "Compliance", "Solutions", "Take-back",
    "Producer Responsibility", "Stewardship", "Compliance Services",
    "Regulatory Solutions"
    Common operators in DACH: "Take-e-way", "Lizenzero", "Reclay",
    "Landbell", "Interseroh", "Der Grüne Punkt", "Activate",
    "Ecologistik", "EcoVadis", "RecycleNow"

- **Fiscal Representative** (VAT):
    "Vertretung gemäß § 22a UStG" / "§ 22a UStG-Bevollmächtigter"
    "Fiscalt repræsentant"
    "Représentant fiscal"
    "Representante fiscal"
    Common operators: "Hellotax", "Avalara", "Amavat", "JPA Direct"
    Strongest tell: the seller is non-EU (China / US / Turkey / etc) but
    holds a DE/FR/IT/ES VAT through someone else's office address.

- **WEEE Representative** (Elektrogesetz):
    "Bevollmächtigter nach ElektroG"
    "WEEE-Bevollmächtigter"
    "Authorised representative ElektroG"
    Common operators: "take-e-way", "noventiz", "Ecosystem"

- **Combined platforms**: Hellotax, Avalara, Amavat, Eurora, Simply VAT,
  Avask, J&P Accountants, Pan EU 7, AVASK, RM Boulanger, KMLZ, Ecovis.
  If you see any of these names as the contact company, flag it.

Heuristics that strengthen the agency signal:
- Seller country of incorporation (China / Hong Kong / US / Turkey / India)
  combined with a DE/FR/IT impressum operator whose name doesn't match
  the Amazon business name.
- Multiple unrelated sellers sharing the same impressum address.
- Impressum domain ≠ any plausible seller-website domain.
- Role title explicitly references EU representation.

When you flag agency, set decision_maker.* fields to null — the agency
contact is NOT the outreach target.

# Decision-maker selection rules (in order of priority)

1. **Personal email beats generic email** — every time. Even if the only
   personal-looking email has low signal strength, it beats info@.
   Pattern matching for personal: "firstname.lastname@", "f.lastname@",
   "firstinitial+lastname@" ("jsmith@"), "firstname@" when followed by
   the surname domain ("max@max-mustermann.de").

2. **Registry officers are authoritative for legal control.** Companies
   House and Pappers tell you who the legal directors are. Impressum
   tells you who's publishing the website. When they agree, confidence
   is high. When they disagree:
   - If impressum officer matches an email contact ("j.smith@" + officer
     "John Smith"), they're the operational contact — pick them.
   - If impressum officer is unrelated to any email, but matches a
     **resigned** registry officer, ignore them (the registry is fresh).
   - If impressum officer is a different person than the registry director
     and you have personal emails for both, the registry director is the
     better outreach target (sole officer of an Ltd is usually the founder).

3. **Director > Managing Director > Geschäftsführer > Owner > Inhaber >
   President / Président > Amministratore > Secretary > Member.**
   Skip resigned officers entirely.

4. **Email-to-officer matching.** When you see "max.m@acme.de" and an
   officer named "Max Mustermann", or "j.dupont@acme.fr" and "DUPONT Jean":
   they're the same person. Set role to the officer's role, name to the
   officer's casing, email to the email. This is by far the strongest
   outreach signal — confidence 90+.

5. **One language per record.** Use the role title in its native language:
   - DE: Geschäftsführer / Inhaber / Vorstand / Prokurist
   - GB: director / managing director / company secretary
   - FR: Président / Directeur général / Gérant
   - IT: Amministratore unico / Amministratore delegato / Presidente
   - ES: Administrador único / Consejero delegado
   Don't translate to English unless the original is English.

6. **Phone selection.** Strip extensions, hours-of-operation suffixes, and
   "fax:" prefixes. If multiple numbers exist, prefer the one nearest to
   the officer name in the source text. If you only see a fax number,
   return null. Format as E.164: "+CC...".

7. **One decision-maker per record.** Even if multiple directors are listed,
   pick ONE. If the choice is arbitrary (two co-directors with identical
   evidence), prefer the one with a personal email; if both have personal
   emails, prefer the one whose first-letter-of-last-name comes earliest
   alphabetically. This is deterministic on purpose.

# Resolving identity conflicts

Sources will sometimes disagree on the company name itself:
- VIES says "ACME TRADING LIMITED", Companies House says "ACME TRADING LTD".
  → Same entity. Trust Companies House (richer record).
- VIES says "ACME TRADING LIMITED", Companies House lookup found nothing,
  impressum says "ACME UK Ltd".
  → Different entity. Add a note. Trust the impressum operator only if
    its address matches VIES.
- Pappers says "ACME SARL" with siege in Paris, impressum says "ACME GmbH"
  with address in Hamburg.
  → Different entities — possibly a group structure. Decision-maker should
    be the German one if the seller's amazon.de target marketplace is
    Germany. Add a note flagging the parent/subsidiary ambiguity.

# Worked examples

## Example 1 — clean UK seller, all signals aligned

Input:
{
  "seller_id": "A1B2C3D4",
  "country": "GB",
  "vat": "GB123456789",
  "business_name": "ACME TRADING LIMITED",
  "vies": {"name": "ACME TRADING LIMITED", "address": "10 Downing St, London"},
  "companies_house": {
    "company_name": "ACME TRADING LIMITED",
    "company_number": "12345678",
    "status": "active",
    "officers": [
      {"name": "SMITH, John", "role": "director", "appointed_on": "2020-01-01"},
      {"name": "DOE, Jane", "role": "secretary"}
    ]
  },
  "impressum": {
    "emails": ["john.smith@acmetrading.co.uk", "info@acmetrading.co.uk"],
    "phones": ["+442012345678"],
    "officers": [{"name": "John Smith", "role": "Director"}],
    "source_url": "https://acmetrading.co.uk/legal-notice"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": "SMITH, John",
    "role": "director",
    "email": "john.smith@acmetrading.co.uk",
    "phone": "+442012345678",
    "confidence": 95
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": [
    "Impressum officer 'John Smith' matches CH director SMITH, John",
    "Secretary DOE skipped per director-preference rule"
  ]
}

## Example 2 — Chinese seller with GPSR EU representative

Input:
{
  "seller_id": "C9D8E7F6",
  "country": "CN",
  "vat": "DE999999999",
  "business_name": "Shenzhen Bright Trading Co Ltd",
  "vies": {"name": "SHENZHEN BRIGHT TRADING CO LTD", "address": "Shenzhen, CN"},
  "impressum": {
    "emails": ["compliance@gpsr-eu-rep.com", "office@gpsr-eu-rep.com"],
    "phones": ["+493012345678"],
    "officers": [
      {"name": "GPSR EU Representative GmbH",
       "role": "Authorised representative pursuant to Article 16 GPSR"}
    ],
    "source_url": "https://gpsr-eu-rep.com/impressum"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": null, "role": null, "email": null, "phone": null, "confidence": 0
  },
  "agency_flag": {
    "is_agency": true,
    "reason": "Impressum lists 'GPSR EU Representative GmbH' under Article 16 GPSR — regulatory agent, not the seller. All contacts route to the agency."
  },
  "notes": [
    "Seller is CN-incorporated; uses DE VAT through fiscal rep (parallel pattern)",
    "Discard: outreach goes to GPSR agency, not Shenzhen Bright"
  ]
}

## Example 3 — Italian seller, weak signals

Input:
{
  "seller_id": "I7T8R9Y0",
  "country": "IT",
  "vat": "IT12345678901",
  "business_name": "Foo SRL",
  "vies": {"name": "FOO SRL", "address": "Via Roma 1, 00100 Roma"},
  "impressum": {
    "emails": ["info@foo-it.it"],
    "phones": [],
    "officers": [],
    "source_url": "https://foo-it.it/note-legali"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": null, "role": null,
    "email": "info@foo-it.it", "phone": null,
    "confidence": 20
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": [
    "No named officer in any source; only generic info@ available",
    "Italian registry lookup recommended for Amministratore name"
  ]
}

## Example 4 — French seller, multiple representatives, email-officer match

Input:
{
  "seller_id": "F4R5C6N7",
  "country": "FR",
  "vat": "FRXX123456789",
  "business_name": "ACME SARL",
  "vies": {"name": "ACME SARL", "address": "10 Rue de la Paix, 75001 Paris"},
  "pappers": {
    "company_name": "ACME SARL",
    "company_number": "123456789",
    "legal_form": "SARL",
    "officers": [
      {"name": "Dupont Jean", "role": "Président"},
      {"name": "Martin Sophie", "role": "Directeur général"}
    ]
  },
  "impressum": {
    "emails": ["j.dupont@acme.fr", "contact@acme.fr"],
    "phones": ["+33142345678"],
    "officers": [],
    "source_url": "https://acme.fr/mentions-legales"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": "Dupont Jean",
    "role": "Président",
    "email": "j.dupont@acme.fr",
    "phone": "+33142345678",
    "confidence": 92
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": [
    "Email j.dupont@acme.fr matches Pappers Président Dupont Jean (initial.last pattern)",
    "Directeur général Sophie Martin available as secondary"
  ]
}

## Example 5 — DE-domiciled fiscal-rep agency for a Turkish seller

Input:
{
  "seller_id": "T1U2R3K4",
  "country": "TR",
  "vat": "DE888777666",
  "business_name": "Yildirim Tekstil A.S.",
  "vies": {"name": "AVALARA EUROPE LIMITED", "address": "Brighton, UK"},
  "impressum": {
    "emails": ["de.tax@avalara.com", "support@avalara.com"],
    "phones": ["+493078787878"],
    "officers": [{"name": "Avalara Europe Ltd", "role": "Steuerlicher Vertreter"}],
    "source_url": "https://avalara.com/de-impressum"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": null, "role": null, "email": null, "phone": null, "confidence": 0
  },
  "agency_flag": {
    "is_agency": true,
    "reason": "VIES VAT-DE points to Avalara Europe Ltd as fiscal representative, not seller Yildirim. Impressum confirms 'Steuerlicher Vertreter' role."
  },
  "notes": [
    "Seller is TR-incorporated; DE VAT held through Avalara fiscal-rep arrangement",
    "Original seller (Yildirim Tekstil A.S.) needs separate research outside this record"
  ]
}

## Example 6 — DE seller (this is the rare case where DE makes it through)

Input:
{
  "seller_id": "D1E2F3G4",
  "country": "DE",
  "vat": "DE123456789",
  "business_name": "Müller Handels GmbH",
  "vies": {"name": "MÜLLER HANDELS GMBH", "address": "Hauptstr 10, 80331 München"},
  "impressum": {
    "emails": ["h.mueller@mueller-handels.de"],
    "phones": ["+498912345678"],
    "officers": [{"name": "Hans Müller", "role": "Geschäftsführer"}],
    "source_url": "https://mueller-handels.de/impressum"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": "Hans Müller",
    "role": "Geschäftsführer",
    "email": "h.mueller@mueller-handels.de",
    "phone": "+498912345678",
    "confidence": 90
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": ["DE-resident seller — verify with caller before outreach (feature-flagged)"]
}

## Example 7 — Spanish seller, mixed-language impressum, multi-contact

Input:
{
  "seller_id": "E5S6P7N8",
  "country": "ES",
  "vat": "ESB12345678",
  "business_name": "GARCIA ELECTRONICA SL",
  "vies": {"name": "GARCIA ELECTRONICA SL", "address": "Calle Mayor 25, 28013 Madrid"},
  "impressum": {
    "emails": [
      "miguel.garcia@garcia-electronica.es",
      "ventas@garcia-electronica.es",
      "support@garcia-electronica.es",
      "contabilidad@garcia-electronica.es"
    ],
    "phones": ["+34915550100", "+34915550199"],
    "officers": [
      {"name": "Miguel Garcia", "role": "Administrador único"},
      {"name": "Ana Lopez", "role": "Responsable comercial"}
    ],
    "source_url": "https://garcia-electronica.es/aviso-legal"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": "Miguel Garcia",
    "role": "Administrador único",
    "email": "miguel.garcia@garcia-electronica.es",
    "phone": "+34915550100",
    "confidence": 88
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": [
    "Personal email matches Administrador único; chose first listed phone",
    "Ana Lopez (commercial) is secondary contact if Miguel doesn't respond",
    "ventas@ / support@ / contabilidad@ kept aside as generic fallbacks"
  ]
}

## Example 8 — US reseller using a UK shell, ambiguous structure

Input:
{
  "seller_id": "U1S2A3B4",
  "country": "US",
  "vat": "GB123987654",
  "business_name": "Pacific Outdoor Gear LLC",
  "vies": {"name": "PACIFIC OUTDOOR UK LTD", "address": "20 Old Bailey, London"},
  "companies_house": {
    "company_name": "PACIFIC OUTDOOR UK LTD",
    "company_number": "98765432",
    "status": "active",
    "officers": [
      {"name": "WILLIAMS, Sarah", "role": "director", "appointed_on": "2023-06-01"}
    ]
  },
  "impressum": {
    "emails": ["sarah@pacificoutdoor.com", "info@pacificoutdoor.com"],
    "phones": ["+12065551234"],
    "officers": [{"name": "Sarah Williams", "role": "Director"}],
    "source_url": "https://pacificoutdoor.com/legal"
  }
}

Output:
{
  "consolidated_decision_maker": {
    "name": "WILLIAMS, Sarah",
    "role": "director",
    "email": "sarah@pacificoutdoor.com",
    "phone": "+12065551234",
    "confidence": 87
  },
  "agency_flag": {"is_agency": false, "reason": null},
  "notes": [
    "US LLC operating via UK Ltd shell; Sarah Williams is director of both",
    "Amazon business_name (Pacific Outdoor Gear LLC) differs from VIES (Pacific Outdoor UK Ltd) — group structure, same operator",
    "US phone number suggests primary office is US-side, not London"
  ]
}

# Anti-patterns to avoid

- **Picking a first name "Sarah" or "Max" alone as the decision_maker.name**
  when the source records the full name elsewhere. Always carry the full name.

- **Returning a department alias as `decision_maker.name`** —
  "Sales Team", "DTC Sales", "Support", "Customer Service", "Info",
  "Marketing", "PR", "Wholesale". These are inboxes, not people. If a
  team-alias email is the only contact ("dtc.sales@emeet.com" with no
  named individual found), set `name: null`, keep the email in the
  `email` field, and add a note ("only team-alias contact found, no
  named decision-maker identified"). The downstream operator will then
  know this row needs LinkedIn research before outreach, not a cold
  email to a no-one inbox.

- **Treating a company-form email ("contact@company.com") as personal** even
  when the company is small. Generic addresses route to whoever monitors
  the shared inbox — usually nobody senior. Confidence ≤ 30 for these.

- **Inflating confidence because all sources agree.** Three sources saying
  the same generic email doesn't make it personal. Source agreement
  matters; signal quality matters more.

- **Confusing a fiscal/EPR representative with a parent company.** A parent
  company is part of the seller (legitimate target). A fiscal rep is a
  third-party service provider (skip). Distinguishing signals:
  - Parent company often shares the brand name ("Acme Holdings GmbH"
    parent of "Acme Trading GmbH").
  - Fiscal rep companies are generic-named ("Hellotax", "Avalara",
    "Eurora Compliance Solutions") and have many unrelated sellers
    routed through them.

- **Returning `agency_flag.reason: ""`** instead of `null`. Use null when
  not flagged. Reason is only populated when is_agency is true.

- **Returning a `notes` entry that just repeats one of the structured fields**
  ("Decision maker is John Smith"). Notes exist to capture what does NOT
  fit the structured fields.

- **Translating role titles.** "Geschäftsführer" stays "Geschäftsführer",
  not "Managing Director". Operators read these directly.

# Hard constraints

- **Use only evidence present in the input.** Do not invent emails, phones,
  names, or roles. If a field is genuinely unknown, return null.
- **Don't backfill nulls to satisfy schema completeness.** A confident null
  is worth more than a hallucinated guess. False positives waste real
  outreach budget.
- **Confidence is your honesty knob.** If you had to make a judgment call
  to pick one of two officers, that's confidence 60-70, not 90.
- **Notes are operator-facing.** Keep each note concrete, specific, and
  actionable. Don't restate obvious facts.
- **Never copy raw text verbatim into notes.** Summarise.

Respond with JSON only — no preamble, no explanation, no markdown fencing.
The response must conform exactly to the provided schema."""


# Composed prompts per pass. Both share the consolidation body so PASS 1 and
# PASS 2 agree on the schema, decision rules, agency patterns, and worked
# examples — only the front-matter (research mandate vs. consolidation-only
# mandate) differs.
HAIKU_SYSTEM_PROMPT = HAIKU_PASS1_PREFIX + SYSTEM_PROMPT_BODY
SONNET_SYSTEM_PROMPT = RESEARCH_PROMPT_PREFIX + SYSTEM_PROMPT_BODY


# JSON Schema for output_config.format. Structured outputs require
# additionalProperties: false on every object and all properties listed
# in required.
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "consolidated_decision_maker": {
            "type": "object",
            "properties": {
                "name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "role": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "email": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "phone": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                "confidence": {"type": "integer"},
            },
            "required": ["name", "role", "email", "phone", "confidence"],
            "additionalProperties": False,
        },
        "agency_flag": {
            "type": "object",
            "properties": {
                "is_agency": {"type": "boolean"},
                "reason": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            },
            "required": ["is_agency", "reason"],
            "additionalProperties": False,
        },
        "notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["consolidated_decision_maker", "agency_flag", "notes"],
    "additionalProperties": False,
}


# Tokens that, when standing alone or paired with a geographic qualifier
# inside a "decision_maker.name", betray a team alias rather than a real
# person. The LLM prompt already says to reject these, but observed
# compliance is partial (PASS 2 still returned "Support India" and
# "Sales Usa" on the post-bugfix run) so we enforce the rule in code too.
_TEAM_ALIAS_TOKENS = {
    "sales", "support", "service", "info", "contact", "office", "team",
    "staff", "admin", "press", "pr", "media", "marketing", "hr", "help",
    "helpdesk", "customer", "customercare", "customerservice", "wholesale",
    "affiliate", "partner", "partners", "reviews", "dtc", "b2b", "b2c",
    "verkauf", "vertrieb", "kontakt", "buchhaltung", "empfang",
    "réception", "reception", "atención", "atencion", "servicio",
    "equipo", "vendite",
}

# Geographic / pluralisers commonly appended to the alias above
# ("Sales USA", "Support India", "Team UK"). They mask the alias from a
# naive "is it a one-word generic" check, so they're treated as filler.
_ALIAS_QUALIFIER_TOKENS = {
    "usa", "us", "uk", "eu", "de", "fr", "es", "it", "nl", "pl",
    "india", "china", "japan", "global", "international", "worldwide",
    "europe", "asia", "america", "online", "shop", "store", "direct",
    "team", "group",
}


def _looks_like_team_alias(name: str) -> bool:
    """True when `name` looks like a department / team inbox masquerading
    as a person ("DTC Sales", "Support India", "Customer Care").

    Heuristic: split on whitespace + punctuation, lowercase, drop
    qualifier filler. If every remaining token is a known team-alias
    token, it's an alias. A real human name has at least one token that
    isn't on either list.
    """
    if not name:
        return False
    tokens = [t for t in re.split(r"[\s,.\-_/]+", name.lower()) if t]
    if not tokens:
        return False
    meaningful = [t for t in tokens if t not in _ALIAS_QUALIFIER_TOKENS]
    if not meaningful:
        # all-qualifier names are aliases too ("Global Team", "USA EU")
        return True
    # If every meaningful token is a known alias token, it's an alias.
    return all(t in _TEAM_ALIAS_TOKENS for t in meaningful)


def _sanitize_team_aliases(parsed: dict) -> dict:
    """Post-process the LLM's parsed result: null out decision_maker.name
    when it's a team alias, downgrade confidence accordingly, and record
    the override in `notes` so the operator sees what happened.

    Email and phone are LEFT IN PLACE — they're still a reachable channel,
    just not a personal one. Pipeline downstream picks up the registry
    director (CH / Pappers officers) for the name slot instead.
    """
    dm = parsed.get("consolidated_decision_maker") or {}
    name = dm.get("name")
    if not name or not _looks_like_team_alias(name):
        return parsed
    original = name
    dm["name"] = None
    if (dm.get("confidence") or 0) > 30:
        # alias-only contact is at best confidence 30 (reachable inbox, no person)
        dm["confidence"] = 30
    parsed["consolidated_decision_maker"] = dm
    notes = list(parsed.get("notes") or [])
    notes.append(
        f"post-processing: rejected team alias {original!r} as decision_maker.name; "
        f"no named individual identified, email/phone retained as inbox channel"
    )
    parsed["notes"] = notes
    return parsed


_client: Optional[anthropic.Anthropic] = None


def _get_client() -> Optional[anthropic.Anthropic]:
    global _client
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _prepare_payload(sources: dict) -> str:
    """Deterministic JSON encoding of the evidence bundle, with truncation of
    the Amazon raw-text excerpt if the bundle is huge.
    """
    payload = json.dumps(sources, ensure_ascii=False, sort_keys=True, default=str)
    if len(payload) > PAYLOAD_CHAR_LIMIT:
        log.warning(
            "LLM merge payload size %d > %d; truncating raw_text_excerpt",
            len(payload), PAYLOAD_CHAR_LIMIT,
        )
        slim = dict(sources)
        slim["raw_text_excerpt"] = (slim.get("raw_text_excerpt") or "")[:2000]
        payload = json.dumps(slim, ensure_ascii=False, sort_keys=True, default=str)
    return payload


def _build_meta(model: str, response) -> dict:
    """Pulls billable signals off the Anthropic response so callers can compute
    per-seller cost without re-parsing logs."""
    usage = response.usage
    server_tool_use = getattr(usage, "server_tool_use", None)
    return {
        "model": model,
        "input_tokens": usage.input_tokens,
        "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
        "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
        "output_tokens": usage.output_tokens,
        "server_tool_use": server_tool_use and {
            "web_search_requests": getattr(server_tool_use, "web_search_requests", 0),
        },
        "stop_reason": response.stop_reason,
    }


def _call_pass(
    model: str,
    system_prompt: str,
    user_payload: str,
    seller_id: str | None,
    *,
    tools: list[dict] | None = None,
) -> Optional[dict]:
    """Single Anthropic call. Returns parsed JSON dict (with `_meta` attached)
    or None on any failure / refusal / non-JSON output. Caller is responsible
    for higher-level orchestration (escalation, fallbacks)."""
    client = _get_client()
    if client is None:
        log.info("ANTHROPIC_API_KEY not set; skipping LLM merge")
        return None

    kwargs: dict = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        "messages": [
            {"role": "user", "content": f"Consolidate this seller record:\n\n{user_payload}"}
        ],
        "output_config": {
            "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}
        },
    }
    if tools:
        kwargs["tools"] = tools

    try:
        response = client.messages.create(**kwargs)
    except anthropic.APIError as exc:
        log.warning("Anthropic APIError (%s) during LLM merge for %s: %s",
                    model, seller_id, exc)
        return None
    except Exception:
        log.exception("Unexpected error (%s) during LLM merge for %s",
                      model, seller_id)
        return None

    meta = _build_meta(model, response)
    usage = response.usage
    log.info(
        "LLM merge %s [%s]: in=%s cache_w=%s cache_r=%s out=%s stop=%s",
        seller_id, model,
        usage.input_tokens,
        getattr(usage, "cache_creation_input_tokens", 0) or 0,
        getattr(usage, "cache_read_input_tokens", 0) or 0,
        usage.output_tokens,
        response.stop_reason,
    )

    if response.stop_reason == "refusal":
        log.warning("LLM merge refused (%s) for %s", model, seller_id)
        return {"_meta": meta, "_refused": True}

    for block in response.content:
        if getattr(block, "type", None) == "text":
            try:
                parsed = json.loads(block.text)
                # Deterministic post-processing: reject team-alias names that
                # slipped past the prompt rule. Done before _meta is attached
                # so the meta on the returned dict is unaffected.
                parsed = _sanitize_team_aliases(parsed)
                parsed["_meta"] = meta
                return parsed
            except json.JSONDecodeError:
                log.warning("LLM merge returned non-JSON (%s) for %s: %s",
                            model, seller_id, block.text[:200])
                return {"_meta": meta, "_error": "non_json"}

    log.warning("LLM merge response had no text content (%s) for %s",
                model, seller_id)
    return {"_meta": meta, "_error": "no_text"}


def consolidate_haiku_structured(sources: dict) -> Optional[dict]:
    """PASS 1 — Haiku 4.5, no tools. Cheap consolidation of the structured
    sources we already gathered. Returns the same shape as PASS 2 (so the
    orchestrator can return either verbatim).
    """
    return _call_pass(
        model=HAIKU_MODEL,
        system_prompt=HAIKU_SYSTEM_PROMPT,
        user_payload=_prepare_payload(sources),
        seller_id=sources.get("seller_id"),
        tools=None,
    )


def consolidate_sonnet_websearch(
    sources: dict,
    prior_consolidation: Optional[dict] = None,
) -> Optional[dict]:
    """PASS 2 — Sonnet 4.6 with web_search tool. Agentic research for markets
    without free registry coverage. If `prior_consolidation` is given, it's
    merged into the payload as `prior_consolidation` so Sonnet can verify
    or supersede PASS 1's pick instead of starting from scratch.
    """
    enriched = dict(sources)
    if prior_consolidation:
        # strip internal fields before showing to the LLM
        prior_clean = {k: v for k, v in prior_consolidation.items() if not k.startswith("_")}
        enriched["prior_consolidation"] = prior_clean
    return _call_pass(
        model=SONNET_MODEL,
        system_prompt=SONNET_SYSTEM_PROMPT,
        user_payload=_prepare_payload(enriched),
        seller_id=sources.get("seller_id"),
        tools=[WEB_SEARCH_TOOL],
    )


def _is_usable(merge: Optional[dict]) -> bool:
    """True if the LLM call returned a parsed consolidation (not None and
    not just a meta-only error stub)."""
    if not merge:
        return False
    return "consolidated_decision_maker" in merge


def _has_registry_officers(sources: dict) -> bool:
    """True when the bundle carries officer data from an authoritative
    registry (Companies House or Pappers). Used by the orchestrator to
    short-circuit PASS 2 — if we already have a director's name from an
    official source, web research rarely surfaces a better personal email
    for the same role, so the PASS 2 budget is poorly spent.
    """
    for key in ("companies_house", "pappers"):
        payload = sources.get(key) or {}
        if isinstance(payload, dict) and payload.get("officers"):
            return True
    return False


def consolidate_2pass(
    sources: dict,
    confidence_threshold: int = DEFAULT_CONFIDENCE_THRESHOLD,
) -> Optional[dict]:
    """Two-pass entry point.

    PASS 1 (Haiku, structured-only) runs for every seller.

    PASS 2 (Sonnet + web_search) is skipped when ANY of:
      - PASS 1 flagged agency (outreach excluded regardless)
      - PASS 1 confidence >= `confidence_threshold`
      - PASS 1 produced a named decision-maker AND the bundle has registry
        officers (CH / Pappers): research has nothing realistic to add to a
        registry-confirmed director name

    Otherwise PASS 2 runs and gets PASS 1's output as `prior_consolidation`.

    Returns a dict matching OUTPUT_SCHEMA, augmented with:
      - `_metas`: list of per-call meta dicts
      - `_escalated`: bool
      - `_skip_reason`: 'agency' | 'high_confidence' | 'registry_officer' | None
    """
    metas: list[dict] = []

    pass1 = consolidate_haiku_structured(sources)
    if pass1 and pass1.get("_meta"):
        metas.append(pass1["_meta"])

    pass1_usable = _is_usable(pass1)
    skip_reason: str | None = None
    if pass1_usable:
        dm = pass1.get("consolidated_decision_maker") or {}
        agency = pass1.get("agency_flag") or {}
        conf = dm.get("confidence") or 0
        flagged = bool(agency.get("is_agency"))
        has_named_dm = bool(dm.get("name"))
        if flagged:
            skip_reason = "agency"
        elif conf >= confidence_threshold:
            skip_reason = "high_confidence"
        elif has_named_dm and _has_registry_officers(sources):
            skip_reason = "registry_officer"

    if pass1_usable and skip_reason is not None:
        pass1["_metas"] = metas
        pass1["_escalated"] = False
        pass1["_skip_reason"] = skip_reason
        return pass1

    # Escalate to PASS 2.
    pass2 = consolidate_sonnet_websearch(
        sources,
        prior_consolidation=pass1 if pass1_usable else None,
    )
    if pass2 and pass2.get("_meta"):
        metas.append(pass2["_meta"])

    if _is_usable(pass2):
        pass2["_metas"] = metas
        pass2["_escalated"] = True
        pass2["_skip_reason"] = None
        return pass2

    # PASS 2 failed. Return PASS 1 if it was at least parseable.
    if pass1_usable:
        pass1["_metas"] = metas
        pass1["_escalated"] = True  # we tried, just failed
        pass1["_skip_reason"] = None
        return pass1
    return None


# Public entry point. Keeps pipeline.py call site stable while we tune the
# orchestrator. Pass-through wrapper — feel free to call consolidate_2pass
# directly if you want a different threshold.
def consolidate(sources: dict) -> Optional[dict]:
    """Backwards-compatible entry point. Routes through the 2-pass orchestrator
    at the default threshold (60). Existing callers (pipeline.py) keep working;
    extra `_metas` / `_escalated` keys are silently ignored by _ingest_llm_merge.
    """
    return consolidate_2pass(sources)
