#!/usr/bin/env bash
# =============================================================================
# clone-template.sh  <subdom>
# WAAS Faza B — skrypt #1 (v3)
#
# Klonuje KANON 'template-standard' -> <subdom>:
#   DB + uploads + retrofit plikow + safety-net + WC-coming-soon-off + active_plugins.
# Uruchamiany z WSL; cala robota na hostingerze przez ssh.
#
#   ./clone-template.sh outdoor-sitzkissen
#
# === v3 zmiana wzgledem v2 (29.05) ===
# v2 kopiowal tylko `wp-content/uploads/` -> po klonie cel mial DB.active_plugins z
# template-a, ale pliki pluginow/themes BRAK -> WP dezaktywowal je przy pierwszym
# page-load. Retrofit byl konieczny recznie. v3 dorzuca 4 nowe kroki:
#   [5] retrofit plikow `plugins/`, `mu-plugins/`, `themes/` — kopiuje KATALOG/plik
#       z template TYLKO gdy celu nie ma. `.bak*` `.backup*` pomijane. Cel zachowuje
#       wszystko swoje (np. nowsza waas-direct-publish.php 90kB, seo-by-rank-math).
#   [6] safety-net et_full_width_page — INSERT meta `_et_pb_page_layout` dla pages
#       BEZ tej meta. NIE nadpisuje istniejacych wartosci (gdybys swiadomie ustawil
#       et_no_sidebar dla jakiejs strony, zostanie).
#   [7] WooCommerce 'Store coming soon' = no — od razu publicznie po klonie.
#   [8] rebuild active_plugins — bierze liste z DB template-a, filtruje przez
#       istnienie pliku na celu, zapisuje do DB celu. Defensive: nawet jesli WP
#       zostal pingniety miedzy importem a retrofitem, aktywacja sie odzyska.
#
# v2 (28.05) — bypass LVE-kill: `mariadb-dump`/`mariadb` zamiast `wp db export/import`.
# Bez zmian w v3.
#
# Co robi (w tej kolejnosci):
#   0. guardy (subdom, ssh, docroot, binarki)
#   1. BACKUP DB celu  -> ~/waas-backups/<subdom>_<ts>.sql
#   2. export DB template -> import do celu
#   3. wp search-replace: domena + sciezka docroot
#   4. rsync uploadow template -> cel (bez --delete)
#   5. retrofit plikow plugins/mu-plugins/themes (tylko brakujace, .bak* pomijane)
#   6. safety-net et_full_width_page (INSERT brakujacych meta)
#   7. WooCommerce 'Store coming soon' = no
#   8. rebuild active_plugins celu (template-a ∩ pliki-na-celu)
#   9. czyszczenie et-cache/cache + wp cache flush + rewrite flush
#
# UWAGA: import nadpisuje wp_users/app-passwords celu trescia template.
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
if ! timeout 30 ssh "$SSH_HOST" "test -f '$BASE/$SUBDOM/wp-config.php' && test -f '$BASE/$TEMPLATE/wp-config.php' && command -v mariadb-dump >/dev/null && command -v mariadb >/dev/null && command -v rsync >/dev/null && command -v php >/dev/null"; then
  echo "BLAD: brak wp-config.php celu/template lub binarek (mariadb-dump/mariadb/rsync/php)." >&2
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
SQL_TMP="/tmp/waas_activate_${SUBDOM}_${TS}.sql"

TPL_CNF="$(mktemp)"; chmod 600 "$TPL_CNF"
DST_CNF="$(mktemp)"; chmod 600 "$DST_CNF"
trap 'rm -f "$TPL_CNF" "$DST_CNF" "$TPL_DUMP" "$SQL_TMP"' EXIT

echo "   src=$TPL_DIR"
echo "   dst=$DST_DIR"

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

# --- 1. BACKUP DB celu ---
mkdir -p "$BK_DIR"
echo ">> [1] backup DB celu -> $BK_FILE"
mariadb-dump --defaults-extra-file="$DST_CNF" "${DUMP_OPTS[@]}" "$DST_DB" > "$BK_FILE"
if [[ ! -s "$BK_FILE" ]] || (( $(stat -c%s "$BK_FILE") < 1024 )); then
  echo "BLAD: backup celu pusty / <1KB — przerywam, zero zmian." >&2
  exit 1
fi
echo "   backup OK ($(du -h "$BK_FILE" | cut -f1))"

# --- 2. export template -> import do celu ---
echo ">> [2a] export DB template -> $TPL_DUMP"
mariadb-dump --defaults-extra-file="$TPL_CNF" "${DUMP_OPTS[@]}" "$TPL_DB" > "$TPL_DUMP"
if [[ ! -s "$TPL_DUMP" ]] || (( $(stat -c%s "$TPL_DUMP") < 1024 )); then
  echo "BLAD: dump template pusty — przerywam (cel nietkniety, backup w $BK_FILE)." >&2
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

# --- 4. rsync uploadow ---
echo ">> [4] rsync uploadow template -> cel..."
mkdir -p "$DST_DIR/wp-content/uploads"
rsync -a "$TPL_DIR/wp-content/uploads/" "$DST_DIR/wp-content/uploads/"
echo "   uploads: $(du -sh "$DST_DIR/wp-content/uploads" | cut -f1)"

# --- 5. retrofit plikow plugins/mu-plugins/themes (tylko brakujace) ---
retrofit_dir() {
  local src="$1" dst="$2" kind="$3"
  local copied=0 skipped=0 baks=0
  mkdir -p "$dst"
  shopt -s nullglob
  for path in "$src"/*; do
    local n; n="$(basename "$path")"
    case "$n" in
      *.bak*|*.backup*) baks=$((baks+1)); continue;;
    esac
    if [[ -e "$dst/$n" ]]; then
      skipped=$((skipped+1))
      continue
    fi
    cp -a "$path" "$dst/$n" && copied=$((copied+1)) || echo "   BLAD cp $kind/$n" >&2
  done
  shopt -u nullglob
  echo "   $kind: skopiowane=$copied, pominiete-istnieje=$skipped, pominiete-bak=$baks"
}

echo ">> [5] retrofit plikow z template (zachowuje wszystko co cel ma)..."
retrofit_dir "$TPL_DIR/wp-content/plugins"    "$DST_DIR/wp-content/plugins"    plugins
retrofit_dir "$TPL_DIR/wp-content/mu-plugins" "$DST_DIR/wp-content/mu-plugins" mu-plugins
retrofit_dir "$TPL_DIR/wp-content/themes"     "$DST_DIR/wp-content/themes"     themes

# --- 6. safety-net et_full_width_page (TYLKO INSERT brakujacych meta) ---
echo ">> [6] safety-net et_full_width_page (INSERT brakujacych, NIE nadpisuje)..."
mariadb --defaults-extra-file="$DST_CNF" "$DST_DB" <<SQL_FULLWIDTH
INSERT INTO wp_postmeta (post_id, meta_key, meta_value)
SELECT p.ID, '_et_pb_page_layout', 'et_full_width_page'
FROM wp_posts p
WHERE p.post_type='page' AND p.post_status='publish'
  AND NOT EXISTS (
    SELECT 1 FROM wp_postmeta m
    WHERE m.post_id=p.ID AND m.meta_key='_et_pb_page_layout'
  );
SELECT ROW_COUNT() AS fullwidth_inserted;
SQL_FULLWIDTH

# --- 7. WooCommerce 'Store coming soon' = no ---
echo ">> [7] WooCommerce 'Store coming soon' -> no (od razu publicznie)..."
mariadb --defaults-extra-file="$DST_CNF" "$DST_DB" <<SQL_COMINGSOON
INSERT INTO wp_options (option_name, option_value, autoload)
VALUES ('woocommerce_coming_soon', 'no', 'yes')
ON DUPLICATE KEY UPDATE option_value='no', autoload='yes';
SQL_COMINGSOON
echo "   woocommerce_coming_soon=no"

# --- 8. rebuild active_plugins (template ∩ pliki-na-celu) ---
echo ">> [8] rebuild active_plugins (filter listy template-a przez pliki celu)..."
mariadb --defaults-extra-file="$TPL_CNF" -BN "$TPL_DB" \
  -e "SELECT option_value FROM wp_options WHERE option_name='active_plugins';" \
  | DST_PLUGINS_DIR="$DST_DIR/wp-content/plugins" php -r '
$serialized = stream_get_contents(STDIN);
$list = @unserialize($serialized);
if (!is_array($list)) {
  fwrite(STDERR, "BLAD: active_plugins z template nie jest array\n");
  exit(1);
}
$dst = getenv("DST_PLUGINS_DIR");
$filtered = [];
$missing  = [];
foreach ($list as $p) {
  if (is_string($p) && file_exists("$dst/$p")) {
    $filtered[] = $p;
  } else {
    $missing[] = $p;
  }
}
$ser = serialize($filtered);
$esc = str_replace("\047", "\047\047", $ser);
printf("UPDATE wp_options SET option_value=\047%s\047 WHERE option_name=\047active_plugins\047;\n", $esc);
fwrite(STDERR, sprintf("   pluginow aktywnych: %d (z %d w template; pominieto bez plikow: %d)\n",
  count($filtered), count($list), count($missing)));
if (!empty($missing)) {
  fwrite(STDERR, "   pominiete (brak plikow): " . implode(", ", $missing) . "\n");
}
' > "$SQL_TMP"

if [[ -s "$SQL_TMP" ]]; then
  mariadb --defaults-extra-file="$DST_CNF" "$DST_DB" < "$SQL_TMP"
  echo "   active_plugins zaktualizowane"
else
  echo "   OSTRZEZENIE: SQL aktywacji pusty, active_plugins nieruszone" >&2
fi

# --- 9. czyszczenie cache + flush ---
echo ">> [9] czyszczenie et-cache/cache + flush..."
rm -rf "$DST_DIR/wp-content/et-cache"/* 2>/dev/null || true
rm -rf "$DST_DIR/wp-content/cache"/*    2>/dev/null || true
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes cache flush   --quiet 2>/dev/null || true
"$WP" --path="$DST_DIR" --skip-plugins --skip-themes rewrite flush --quiet 2>/dev/null || true

# --- raport ---
TPL_POSTS=$(mariadb --defaults-extra-file="$TPL_CNF" -BN -e "SELECT COUNT(*) FROM wp_posts" "$TPL_DB" 2>/dev/null | tr -d '[:space:]')
DST_POSTS=$(mariadb --defaults-extra-file="$DST_CNF" -BN -e "SELECT COUNT(*) FROM wp_posts" "$DST_DB" 2>/dev/null | tr -d '[:space:]')
DST_ACTIVE=$(mariadb --defaults-extra-file="$DST_CNF" -BN -e "SELECT option_value FROM wp_options WHERE option_name='active_plugins'" "$DST_DB" 2>/dev/null \
  | php -r '$a=@unserialize(stream_get_contents(STDIN));echo is_array($a)?count($a):"?";')
echo "================================================================"
echo " KLON GOTOWY: $SUBDOM"
echo "   posty template = $TPL_POSTS   |   posty cel = $DST_POSTS"
echo "   active plugins cel = $DST_ACTIVE"
echo "   backup celu   = $BK_FILE"
echo "   nastepny krok = placeholder-replace.sh $SUBDOM   (#2)"
echo "   pamietaj: odswiez App Password celu przed #2"
echo "================================================================"
REMOTE

echo ">> clone-template.sh v3: ZAKONCZONE dla '$SUBDOM'."
