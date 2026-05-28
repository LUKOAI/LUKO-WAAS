#!/usr/bin/env bash
# =============================================================================
# clone-template.sh  <subdom>
# WAAS Faza B — skrypt #1
# Klonuje KANON 'template-standard' -> <subdom> (DB + uploads + search-replace).
# Uruchamiany z WSL; cala robota na hostingerze przez ssh.
#
#   ./clone-template.sh outdoor-sitzkissen
#
# Co robi (w tej kolejnosci):
#   0. guardy wejscia (subdom podany, != template, ssh zywy, docroot celu istnieje)
#   1. BACKUP DB celu  -> ~/waas-backups/<subdom>_<ts>.sql   (twardy guard)
#   2. export DB template -> import do celu (nadpisuje wp_* trescia kanonu)
#   3. wp search-replace: domena template -> domena celu  (+ sciezka docroot)
#   4. rsync uploadow template -> cel
#   5. czyszczenie et-cache / cache + wp cache flush + rewrite flush
#
# Czego NIE robi: nie tyka placeholderow (#2), nie zmienia uprawnien,
#                 nie kasuje template, nie uzywa --delete na uploadach.
# UWAGA: import nadpisuje tez wp_users/app-passwords celu trescia template.
#        -> App Password celu trzeba odswiezyc przed #2 (auth Niche Replace V4).
# =============================================================================

set -euo pipefail

# ---- konfiguracja (stala dla klastra SPATIUM) -------------------------------
SSH_HOST="hostinger"
BASE="/home/u803296462/domains/lk24.shop/public_html"
WP="/usr/local/bin/wp"
TEMPLATE="template-standard"
SSH_TIMEOUT=900          # s — caly zdalny blok (export+import+rsync 121M)
PROTECTED="template-standard template-multibrand"

# ---- 0. guardy wejscia (strona WSL) ----------------------------------------
SUBDOM="${1:-}"
if [[ -z "$SUBDOM" ]]; then
  echo "BLAD: brak argumentu. Uzycie: $0 <subdom>" >&2
  exit 1
fi
# normalizacja: dopuszczamy podanie z .lk24.shop lub bez -> trzymamy goly slug folderu
SUBDOM="${SUBDOM%.lk24.shop}"

for p in $PROTECTED; do
  if [[ "$SUBDOM" == "$p" ]]; then
    echo "BLAD: '$SUBDOM' to chroniony template — odmowa klonowania na siebie." >&2
    exit 1
  fi
done

echo ">> [0] guardy: ssh '$SSH_HOST' + docroot celu '$SUBDOM'..."
if ! timeout 30 ssh "$SSH_HOST" 'echo ok' >/dev/null 2>&1; then
  echo "BLAD: ssh '$SSH_HOST' nie odpowiada." >&2
  exit 1
fi
if ! timeout 30 ssh "$SSH_HOST" "test -f '$BASE/$SUBDOM/wp-config.php'"; then
  echo "BLAD: brak '$BASE/$SUBDOM/wp-config.php' — cel nie istnieje albo to nie WP." >&2
  exit 1
fi
echo ">> [0] OK."

# ---- 1-5. zdalny blok atomowy ----------------------------------------------
# subdom przekazujemy jako $1 do zdalnego bash -s; heredoc 'REMOTE' = bez interpolacji.
echo ">> wysylam zdalny blok klonujacy (timeout ${SSH_TIMEOUT}s)..."
timeout "$SSH_TIMEOUT" ssh "$SSH_HOST" 'bash -s' "$SUBDOM" <<'REMOTE'
set -euo pipefail

SUBDOM="$1"
BASE="/home/u803296462/domains/lk24.shop/public_html"
WP="/usr/local/bin/wp"
TEMPLATE="template-standard"
TPL_DIR="$BASE/$TEMPLATE"
DST_DIR="$BASE/$SUBDOM"
TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR="$HOME/waas-backups"
BK_FILE="$BK_DIR/${SUBDOM}_${TS}.sql"
TPL_DUMP="/tmp/waas_tpl_${TEMPLATE}_${TS}.sql"

wpc() { "$WP" --path="$1" --skip-plugins --skip-themes "${@:2}"; }

echo "   src=$TPL_DIR"
echo "   dst=$DST_DIR"

# --- 1. BACKUP DB celu (twardy guard) ---
mkdir -p "$BK_DIR"
echo ">> [1] backup DB celu -> $BK_FILE"
"$WP" --path="$DST_DIR" db export "$BK_FILE" --add-drop-table
if [[ ! -s "$BK_FILE" ]]; then
  echo "BLAD: backup celu pusty/niepowstal — przerywam, zero zmian." >&2
  exit 1
fi
echo "   backup OK ($(du -h "$BK_FILE" | cut -f1))"

# --- 2. export template -> import do celu ---
echo ">> [2] export DB template -> $TPL_DUMP"
"$WP" --path="$TPL_DIR" db export "$TPL_DUMP" --add-drop-table
if [[ ! -s "$TPL_DUMP" ]]; then
  echo "BLAD: dump template pusty — przerywam (cel nietkniety, backup w $BK_FILE)." >&2
  exit 1
fi
echo "   dump template OK ($(du -h "$TPL_DUMP" | cut -f1))"

echo ">> [2] import dumpu template do celu (nadpisuje wp_*)..."
"$WP" --path="$DST_DIR" db import "$TPL_DUMP"
echo "   import OK"

# --- 3. search-replace: domena + sciezka docroot ---
echo ">> [3] search-replace domeny: ${TEMPLATE}.lk24.shop -> ${SUBDOM}.lk24.shop"
"$WP" --path="$DST_DIR" search-replace \
  "${TEMPLATE}.lk24.shop" "${SUBDOM}.lk24.shop" \
  --skip-columns=guid --report-changed-only --quiet || true

echo ">> [3] search-replace sciezki docroot: /public_html/${TEMPLATE}/ -> /public_html/${SUBDOM}/"
"$WP" --path="$DST_DIR" search-replace \
  "/public_html/${TEMPLATE}/" "/public_html/${SUBDOM}/" \
  --skip-columns=guid --report-changed-only --quiet || true

# --- 4. rsync uploadow (bez --delete) ---
echo ">> [4] rsync uploadow template -> cel..."
mkdir -p "$DST_DIR/wp-content/uploads"
rsync -a "$TPL_DIR/wp-content/uploads/" "$DST_DIR/wp-content/uploads/"
echo "   uploads: $(du -sh "$DST_DIR/wp-content/uploads" | cut -f1)"

# --- 5. czyszczenie cache + flush ---
echo ">> [5] czyszczenie et-cache/cache + flush..."
rm -rf "$DST_DIR/wp-content/et-cache"/* 2>/dev/null || true
rm -rf "$DST_DIR/wp-content/cache"/* 2>/dev/null || true
"$WP" --path="$DST_DIR" cache flush --quiet 2>/dev/null || true
"$WP" --path="$DST_DIR" rewrite flush --quiet 2>/dev/null || true

# --- sprzatanie tmp ---
rm -f "$TPL_DUMP"

# --- raport ---
TPL_POSTS="$("$WP" --path="$TPL_DIR" db query "SELECT COUNT(*) FROM wp_posts" --skip-column-names 2>/dev/null | tr -d '[:space:]')"
DST_POSTS="$("$WP" --path="$DST_DIR" db query "SELECT COUNT(*) FROM wp_posts" --skip-column-names 2>/dev/null | tr -d '[:space:]')"
echo "================================================================"
echo " KLON GOTOWY: $SUBDOM"
echo "   posty template = $TPL_POSTS   |   posty cel = $DST_POSTS"
echo "   backup celu   = $BK_FILE"
echo "   nastepny krok = placeholder-replace.sh $SUBDOM   (#2)"
echo "   pamietaj: odswiez App Password celu przed #2"
echo "================================================================"
REMOTE

echo ">> clone-template.sh: ZAKONCZONE dla '$SUBDOM'."
