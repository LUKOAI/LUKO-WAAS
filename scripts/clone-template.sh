#!/usr/bin/env bash
# =============================================================================
# clone-template.sh  <subdom>
# WAAS Faza B — skrypt #1 (v2)
#
# Klonuje KANON 'template-standard' -> <subdom> (DB + uploads + search-replace).
# Uruchamiany z WSL; cala robota na hostingerze przez ssh.
#
#   ./clone-template.sh outdoor-sitzkissen
#
# === v2 zmiana wzgledem v1 ===
# `wp db export/import` na tym hostingu jest cicho zabijane (exit 255, brak
# stderr) gdy PHP+wp-cli odpala mysqldump przez proc_open — najpewniej LVE
# /CageFS. `wp --info`, `wp post list`, `wp search-replace --dry-run` chodza
# OK. Diagnoza potwierdzona sondami 28.05.
# Obejscie: backup celu i export template idą bezposrednio przez
# `mariadb-dump --defaults-extra-file=<tmp>` (bez PHP), import przez `mariadb`.
# Creds wyciagniete z wp-config.php do tymczasowego pliku 0600, kasowanego
# przez `trap EXIT`. wp search-replace zostaje (jedyna pewna droga przez
# serializowane metadane Divi).
#
# Co robi (w tej kolejnosci):
#   0. guardy wejscia (subdom podany, != template, ssh zywy, docroot celu, binarki)
#   1. BACKUP DB celu  -> ~/waas-backups/<subdom>_<ts>.sql   (twardy guard)
#   2. export DB template -> import do celu (nadpisuje wp_* trescia kanonu)
#   3. wp search-replace: domena template -> domena celu  (+ sciezka docroot)
#   4. rsync uploadow template -> cel
#   5. czyszczenie et-cache / cache + wp cache flush + rewrite flush
#
# UWAGA: import nadpisuje tez wp_users/app-passwords celu trescia template.
#        -> App Password celu trzeba odswiezyc przed placeholder-replace.sh (#2).
# =============================================================================

set -euo pipefail

SSH_HOST="hostinger"
BASE="/home/u803296462/domains/lk24.shop/public_html"
WP="/usr/local/bin/wp"
TEMPLATE="template-standard"
SSH_TIMEOUT=900
PROTECTED="template-standard template-multibrand"

# ---- 0. guardy wejscia (strona WSL) ----------------------------------------
SUBDOM="${1:-}"
if [[ -z "$SUBDOM" ]]; then
  echo "BLAD: brak argumentu. Uzycie: $0 <subdom>" >&2
  exit 1
fi
SUBDOM="${SUBDOM%.lk24.shop}"

for p in $PROTECTED; do
  if [[ "$SUBDOM" == "$p" ]]; then
    echo "BLAD: '$SUBDOM' to chroniony template — odmowa klonowania na siebie." >&2
    exit 1
  fi
done

echo ">> [0] guardy: ssh '$SSH_HOST' + docroot celu '$SUBDOM' + binarki..."
if ! timeout 30 ssh "$SSH_HOST" 'echo ok' >/dev/null 2>&1; then
  echo "BLAD: ssh '$SSH_HOST' nie odpowiada." >&2
  exit 1
fi
if ! timeout 30 ssh "$SSH_HOST" "test -f '$BASE/$SUBDOM/wp-config.php' && test -f '$BASE/$TEMPLATE/wp-config.php' && command -v mariadb-dump >/dev/null && command -v mariadb >/dev/null && command -v rsync >/dev/null"; then
  echo "BLAD: brak wp-config.php celu/template lub binarek (mariadb-dump/mariadb/rsync)." >&2
  exit 1
fi
echo ">> [0] OK."

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

# tmp pliki creds; trap EXIT czysci nawet przy padzie
TPL_CNF="$(mktemp)"; chmod 600 "$TPL_CNF"
DST_CNF="$(mktemp)"; chmod 600 "$DST_CNF"
trap 'rm -f "$TPL_CNF" "$DST_CNF" "$TPL_DUMP"' EXIT

echo "   src=$TPL_DIR"
echo "   dst=$DST_DIR"

# --- helper: wyciagnij DB_* z wp-config -> plik --defaults-extra-file ---
# uzycie: load_creds <wp-config-path> <cnf-out>  -> echo DB_NAME
load_creds() {
  local wpc="$1" out="$2"
  local DB USR HOSTV PWD_DB
  DB=$(awk -F"'"     '/define\(.*DB_NAME/{print $4; exit}'     "$wpc")
  USR=$(awk -F"'"    '/define\(.*DB_USER/{print $4; exit}'     "$wpc")
  HOSTV=$(awk -F"'"  '/define\(.*DB_HOST/{print $4; exit}'     "$wpc")
  PWD_DB=$(awk -F"'" '/define\(.*DB_PASSWORD/{print $4; exit}' "$wpc")
  if [[ -z "$DB" || -z "$USR" || -z "$HOSTV" || -z "$PWD_DB" ]]; then
    echo "BLAD: nie udalo sie wyciagnac DB_* z $wpc" >&2
    return 1
  fi
  printf '[client]\nuser=%s\npassword=%s\nhost=%s\n' "$USR" "$PWD_DB" "$HOSTV" > "$out"
  echo "$DB"
}

TPL_DB="$(load_creds "$TPL_DIR/wp-config.php" "$TPL_CNF")"
DST_DB="$(load_creds "$DST_DIR/wp-config.php" "$DST_CNF")"
echo "   db template=$TPL_DB  db cel=$DST_DB"

DUMP_OPTS=(--single-transaction --quick --no-tablespaces --default-character-set=utf8mb4)

# --- 1. BACKUP DB celu (twardy guard) ---
mkdir -p "$BK_DIR"
echo ">> [1] backup DB celu -> $BK_FILE"
mariadb-dump --defaults-extra-file="$DST_CNF" "${DUMP_OPTS[@]}" "$DST_DB" > "$BK_FILE"
if [[ ! -s "$BK_FILE" ]] || (( $(stat -c%s "$BK_FILE") < 1024 )); then
  echo "BLAD: backup celu pusty / podejrzanie maly (<1KB) — przerywam, zero zmian." >&2
  exit 1
fi
echo "   backup OK ($(du -h "$BK_FILE" | cut -f1))"

# --- 2. export template -> import do celu ---
echo ">> [2a] export DB template -> $TPL_DUMP"
mariadb-dump --defaults-extra-file="$TPL_CNF" "${DUMP_OPTS[@]}" "$TPL_DB" > "$TPL_DUMP"
if [[ ! -s "$TPL_DUMP" ]] || (( $(stat -c%s "$TPL_DUMP") < 1024 )); then
  echo "BLAD: dump template pusty / podejrzanie maly — przerywam (cel nietkniety, backup w $BK_FILE)." >&2
  exit 1
fi
echo "   dump template OK ($(du -h "$TPL_DUMP" | cut -f1))"

echo ">> [2b] import dumpu template do celu (nadpisuje wp_*)..."
mariadb --defaults-extra-file="$DST_CNF" "$DST_DB" < "$TPL_DUMP"
echo "   import OK"

# --- 3. search-replace: domena + sciezka docroot ---
echo ">> [3a] search-replace domeny: ${TEMPLATE}.lk24.shop -> ${SUBDOM}.lk24.shop"
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes search-replace \
  "${TEMPLATE}.lk24.shop" "${SUBDOM}.lk24.shop" \
  --skip-columns=guid --report-changed-only --quiet || true

echo ">> [3b] search-replace sciezki docroot: /public_html/${TEMPLATE}/ -> /public_html/${SUBDOM}/"
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes search-replace \
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
rm -rf "$DST_DIR/wp-content/cache"/*    2>/dev/null || true
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes cache flush   --quiet 2>/dev/null || true
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes rewrite flush --quiet 2>/dev/null || true

# --- raport (post count przez mariadb, nie wp-cli — taniej i pewniej) ---
TPL_POSTS=$(mariadb --defaults-extra-file="$TPL_CNF" -BN -e "SELECT COUNT(*) FROM wp_posts" "$TPL_DB" 2>/dev/null | tr -d '[:space:]')
DST_POSTS=$(mariadb --defaults-extra-file="$DST_CNF" -BN -e "SELECT COUNT(*) FROM wp_posts" "$DST_DB" 2>/dev/null | tr -d '[:space:]')
echo "================================================================"
echo " KLON GOTOWY: $SUBDOM"
echo "   posty template = $TPL_POSTS   |   posty cel = $DST_POSTS"
echo "   backup celu   = $BK_FILE"
echo "   nastepny krok = placeholder-replace.sh $SUBDOM   (#2)"
echo "   pamietaj: odswiez App Password celu przed #2"
echo "================================================================"
REMOTE

echo ">> clone-template.sh: ZAKONCZONE dla '$SUBDOM'."
