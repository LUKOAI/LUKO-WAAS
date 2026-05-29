#!/usr/bin/env python3
# =============================================================================
# placeholder-replace.py  <subdom> [--dry-run]
# WAAS Faza B - skrypt #2 (v1.1)
#
# v1.1 (29.05): po pierwszym realnym biegu na outdoor-sitzkissen w treści
# kanonu zostały placeholdery pisane lowercase ([patron_brand], 6 wystapien).
# plugin str_replace jest case-sensitive -> dorabiamy aliasy lowercase dla
# kazdej pary. Stara para [PATRON_BRAND] zostaje, dodatkowo idzie [patron_brand]
# z ta sama wartoscia. Bez ryzyka: dwa rozne stringi w bazie, kazdy idzie swoim
# torem. [HERO_H1] (1x w drafcie 1112 "Template Produkt V2 GEO") - poza nasza
# lista 11, zostaje do mechanizmu #3.
#
# Reszta opisu jak w v1.0:
# Odczytuje wiersz z Sites, sklada pary [PLACEHOLDER]->wartosc (11 placeholderow,
# 18 par po rozwinieciu CATEGORY_1..6 i FOOTER_CAT_1..4, +18 aliasow lower =
# 36 par realnie wysylanych) i POST-uje do mu-pluginu waas-niche-replace.php.
#
# Endpoint:  POST https://<subdom>.lk24.shop/wp-json/waas-niche/v1/replace
# Auth:      HTTP Basic z App Password (kolumny "Admin Username" + "App Password"
#            w Sites). Plugin sprawdza current_user_can('manage_options').
# Payload:   {"pairs":[{"old":"[X]","new":"Y"},...], "dry_run": bool}
#
# Sekwencja:
#   1. clone-template.sh <subdom>
#   2. recznie odswiez App Password celu -> wklej w Sites
#   3. placeholder-replace.sh <subdom> --dry-run
#   4. placeholder-replace.sh <subdom>
# =============================================================================

import sys
import json
import time

try:
    import gspread
    import requests
    from requests.auth import HTTPBasicAuth
except ImportError as e:
    print(f"BLAD: brak modulu Pythona: {e.name}. Uruchom przez ~/waas-venv/bin/python "
          f"(scripts/placeholder-replace.sh robi to za Ciebie).", file=sys.stderr)
    sys.exit(1)

SHEET_ID = "1O5IcgueiXtQ0vtwQAKUs_JGbjmsZenwpfDhe1rCEHl8"
SA_JSON  = "/home/lukoai/TaxDocumentProcessor/google_sheets_credentials.json"
SHEET_TAB = "Sites"
DOMAIN_SUFFIX = ".lk24.shop"
PLUGIN_BASE_TPL = "https://{domain}/wp-json/waas-niche/v1"
POST_TIMEOUT = 480
PING_TIMEOUT = 30
MAX_ATTEMPTS = 3

PLACEHOLDERS = [
    ("[SITE_NAME]",          ("compose", ["Brand Display Name", "Site Name"], " ")),
    ("[SITE_DOMAIN]",        ("col", "Domain")),
    ("[PATRON_BRAND]",       ("col", "Patron_Brand")),
    ("[TARGET_USER]",        ("col", "Target_User")),
    ("[NICHE_PLURAL]",       ("col", "Product Category")),
    ("[NICHE_THEME]",        ("col", "Niche_Theme")),
    ("[CATEGORY_1]",         ("col", "Category_1")),
    ("[CATEGORY_2]",         ("col", "Category_2")),
    ("[CATEGORY_3]",         ("col", "Category_3")),
    ("[CATEGORY_4]",         ("col", "Category_4")),
    ("[CATEGORY_5]",         ("col", "Category_5")),
    ("[CATEGORY_6]",         ("col", "Category_6")),
    ("[CUSTOM_GUIDE_LINK]",  ("col", "Custom_Guide_Link")),
    ("[FOOTER_CAT_HEADING]", ("col", "Footer_Cat_Heading")),
    ("[FOOTER_CAT_1]",       ("col", "Footer_Cat_1")),
    ("[FOOTER_CAT_2]",       ("col", "Footer_Cat_2")),
    ("[FOOTER_CAT_3]",       ("col", "Footer_Cat_3")),
    ("[FOOTER_CAT_4]",       ("col", "Footer_Cat_4")),
]

PROTECTED = {"template-standard", "template-multibrand"}


def die(msg, code=1):
    print(f"BLAD: {msg}", file=sys.stderr)
    sys.exit(code)


def parse_args(argv):
    if len(argv) < 2:
        die("brak argumentu. Uzycie: placeholder-replace.py <subdom> [--dry-run]")
    subdom = argv[1]
    if subdom.endswith(DOMAIN_SUFFIX):
        subdom = subdom[: -len(DOMAIN_SUFFIX)]
    if subdom in PROTECTED:
        die(f"'{subdom}' to chroniony template - odmowa.")
    dry_run = "--dry-run" in argv[2:]
    return subdom, dry_run


def read_sites_row(full_domain):
    print(f">> [1] czytam Sites: {full_domain}")
    gc = gspread.service_account(filename=SA_JSON)
    ws = gc.open_by_key(SHEET_ID).worksheet(SHEET_TAB)
    rows = ws.get_all_records()
    row = next((r for r in rows if (r.get("Domain") or "").strip() == full_domain), None)
    if not row:
        die(f"brak wiersza dla Domain='{full_domain}' w zakladce {SHEET_TAB}")
    return row


def build_pairs(row):
    """
    Buduje pary [PLACEHOLDER]->wartosc i dorzuca aliasy lowercase
    (kanon czasem ma case-mismatch, np. [patron_brand]).
    """
    base_pairs, missing = [], []
    for placeholder, spec in PLACEHOLDERS:
        kind = spec[0]
        if kind == "col":
            colname = spec[1]
            val = (row.get(colname) or "").strip()
            if not val:
                missing.append((placeholder, colname))
                continue
            base_pairs.append({"old": placeholder, "new": val})
        elif kind == "compose":
            cols, sep = spec[1], spec[2]
            parts = [(row.get(c) or "").strip() for c in cols]
            if not all(parts):
                missing.append((placeholder, " + ".join(cols)))
                continue
            base_pairs.append({"old": placeholder, "new": sep.join(parts)})
        else:
            die(f"nieznany typ spec: {kind}")
    if missing:
        print("BLAD: brakuje wartosci w Sites dla nastepujacych placeholderow:", file=sys.stderr)
        for p, src in missing:
            print(f"   {p:25} <- {src}", file=sys.stderr)
        sys.exit(1)

    # dorzuc aliasy lowercase (np. [PATRON_BRAND] -> [patron_brand])
    seen = {p["old"] for p in base_pairs}
    alias_pairs = []
    for p in base_pairs:
        low = p["old"].lower()
        if low != p["old"] and low not in seen:
            alias_pairs.append({"old": low, "new": p["new"]})
            seen.add(low)
    return base_pairs, alias_pairs


def get_auth(row):
    user   = (row.get("Admin Username") or "").strip()
    app_pw = (row.get("App Password")   or "").strip()
    if not user:   die("brak 'Admin Username' w Sites")
    if not app_pw: die("brak 'App Password' w Sites - odswiez po klonie (#1)")
    return HTTPBasicAuth(user, app_pw)


def ping(base, auth):
    print(f">> [2] ping {base}/ping")
    try:
        r = requests.get(f"{base}/ping", auth=auth, timeout=PING_TIMEOUT)
    except requests.RequestException as e:
        die(f"ping nieudany: {e}")
    if r.status_code != 200:
        die(f"ping HTTP {r.status_code}: {r.text[:300]}")
    try:
        data = r.json()
    except ValueError:
        die(f"ping zwrocil nie-JSON: {r.text[:300]}")
    if not data.get("success"):
        die(f"ping success=false: {json.dumps(data)[:300]}")
    print(f"   plugin v{data.get('version','?')} OK (czas serwera: {data.get('time','?')})")


def show_pairs(base_pairs, alias_pairs, dry_run):
    print(">> [3] pary do podmiany (wlasciwe):")
    for p in base_pairs:
        v = p["new"] if len(p["new"]) <= 60 else p["new"][:57] + "..."
        print(f"   {p['old']:25} -> {v}")
    if alias_pairs:
        print(f"   + aliasy lowercase: {len(alias_pairs)} par (case-mismatch w kanonie)")
        for p in alias_pairs:
            print(f"     {p['old']:25} -> (jak wyzej)")
    print(f"   tryb: {'DRY-RUN (zero zmian)' if dry_run else 'REAL (zapis do DB)'}")


def post_replace(base, auth, all_pairs, dry_run):
    url = f"{base}/replace"
    payload = {"pairs": all_pairs, "dry_run": dry_run}
    print(f">> [4] POST {url}  (timeout {POST_TIMEOUT}s, max prob: {MAX_ATTEMPTS}, par={len(all_pairs)})")
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            r = requests.post(url, auth=auth, json=payload, timeout=POST_TIMEOUT)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    die(f"odpowiedz nie-JSON: {r.text[:500]}")
            else:
                last_err = f"HTTP {r.status_code}: {r.text[:300]}"
                if 400 <= r.status_code < 500:
                    die(last_err)
        except requests.RequestException as e:
            last_err = str(e)
        if attempt < MAX_ATTEMPTS:
            wait = 2 ** attempt
            print(f"   proba {attempt}/{MAX_ATTEMPTS} nieudana ({last_err}); czekam {wait}s...", file=sys.stderr)
            time.sleep(wait)
    die(f"wszystkie {MAX_ATTEMPTS} proby POST nieudane: {last_err}")


def show_result(data, dry_run, full_domain):
    if not data.get("success"):
        die(f"plugin zwrocil success=false: {json.dumps(data)[:500]}")
    res = data.get("results", {})
    print(">> [5] wynik:")
    print(f"   pairs_processed = {res.get('pairs_processed')}")
    print(f"   dry_run         = {res.get('dry_run')}")
    stats = res.get("stats", [])
    if stats:
        print("   stats per para:")
        total_hits = 0
        for s in stats:
            hits = s.get("hits", 0)
            total_hits += hits
            print(f"     {s.get('old',''):25} hits={hits}")
        print(f"   SUMA hits = {total_hits}")
    print("================================================================")
    print(f" OK: {'DRY-RUN' if dry_run else 'PODSTAWIONE'} dla {full_domain}")
    if dry_run:
        print(" To byl dry-run. Uruchom BEZ --dry-run aby zapisac.")
    else:
        print(" Nastepny krok = ai-fill-narrative.sh (#3)  /  inspekcja w przegladarce")
    print("================================================================")


def main():
    subdom, dry_run = parse_args(sys.argv)
    full_domain = f"{subdom}{DOMAIN_SUFFIX}"
    row  = read_sites_row(full_domain)
    base_pairs, alias_pairs = build_pairs(row)
    all_pairs = base_pairs + alias_pairs
    auth = get_auth(row)
    base = PLUGIN_BASE_TPL.format(domain=full_domain)
    ping(base, auth)
    show_pairs(base_pairs, alias_pairs, dry_run)
    data = post_replace(base, auth, all_pairs, dry_run)
    show_result(data, dry_run, full_domain)


if __name__ == "__main__":
    main()
