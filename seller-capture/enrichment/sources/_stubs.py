"""Source stubs to be filled in. Each module should expose `lookup()` returning a dict
with at least: company_name, address, country, officers[], emails[], phones[], website, source.

Order of priority for filling in:
1. companies_house  — UK, free official API
2. krs              — PL, free REST API
3. handelsregister  — DE, scrape (or Northdata free tier)
4. pappers          — FR, free tier
5. lucid            — DE EPR (packaging) — scrape public search
6. ear_de           — DE WEEE register — scrape
7. bdo_pl           — PL EPR/WEEE/batteries — public API
8. ecoembes         — ES EPR — public list
9. citeo            — FR EPR — public list
10. conai           — IT EPR — public list
11. nwpd            — UK WEEE — public list
12. impressum       — generic scraper for /impressum /kontakt /mentions-legales /aviso-legal /polityka-prywatnosci
13. ebay            — eBay seller about-page scraper
14. kaufland        — Kaufland.de seller impressum scraper
15. allegro         — Allegro.pl seller info scraper (NIP + firma)
16. otto            — OTTO marketplace seller info
17. google_cse      — Google Custom Search wrapper
18. llm_merge       — Claude Haiku / Sonnet for cross-source matching and decision-maker extraction
"""
