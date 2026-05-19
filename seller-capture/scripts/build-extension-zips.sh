#!/usr/bin/env bash
# build-extension-zips.sh — Generate per-operator Chrome extension zips for
# Monika, Maria, and Honesty. Reads endpoint / driveFolderId / sharedSecret
# from env vars (so secrets never go through the chat or into git).
#
# Usage (Cloud Shell or local):
#   export LUKO_ENDPOINT="https://script.google.com/macros/s/AKfycb.../exec"
#   export LUKO_DRIVE_FOLDER_ID="1AbCdEfGhIjKlMnOpQrStUvWxYz"
#   export LUKO_SHARED_SECRET="a7a152bf098ee8db..."   # CAPTURE_SHARED_SECRET
#   bash seller-capture/scripts/build-extension-zips.sh
#
# Produces in seller-capture/dist/:
#   luko-capture-monika.zip   (operatorId=P1)
#   luko-capture-maria.zip    (operatorId=P2)
#   luko-capture-honesty.zip  (operatorId=P3)
#
# Add new operators by appending to the OPERATORS array below.
set -euo pipefail

# Resolve paths regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_SRC="$SCRIPT_DIR/../chrome-extension"
DIST="$SCRIPT_DIR/../dist"

# Required secrets — fail fast if missing.
: "${LUKO_ENDPOINT:?LUKO_ENDPOINT not set. export it before running.}"
: "${LUKO_DRIVE_FOLDER_ID:?LUKO_DRIVE_FOLDER_ID not set.}"
: "${LUKO_SHARED_SECRET:?LUKO_SHARED_SECRET not set.}"

# operator_id : file_suffix : language
OPERATORS=(
  "P1:monika:pl"
  "P2:maria:pl"
  "P3:honesty:en"
)

mkdir -p "$DIST"

# Quote/escape JSON string values for sed substitution. Backslashes, slashes,
# and double quotes are the realistic threats in URLs/secrets.
sed_escape() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

ENDPOINT_ESC="$(sed_escape "$LUKO_ENDPOINT")"
DRIVE_ESC="$(sed_escape "$LUKO_DRIVE_FOLDER_ID")"
SECRET_ESC="$(sed_escape "$LUKO_SHARED_SECRET")"

for entry in "${OPERATORS[@]}"; do
  IFS=':' read -r op_id name lang <<<"$entry"
  echo "→ Building $name (operatorId=$op_id, lang=$lang)"

  STAGE="$(mktemp -d)"
  cp -r "$EXT_SRC" "$STAGE/chrome-extension"

  # Rewrite config.json with the operator-specific + shared values.
  CFG="$STAGE/chrome-extension/config.json"
  sed -i \
    -e "s/PLACEHOLDER_doPost_URL/$ENDPOINT_ESC/" \
    -e "s/PLACEHOLDER_DRIVE_FOLDER_ID/$DRIVE_ESC/" \
    -e "s/PLACEHOLDER_OPERATOR_ID/$op_id/" \
    -e "s/PLACEHOLDER_SHARED_SECRET/$SECRET_ESC/" \
    -e "s/\"lang\": \"pl\"/\"lang\": \"$lang\"/" \
    "$CFG"

  # Verify no PLACEHOLDER_ tokens remain in the built config — if any did,
  # the operator would silently get an unconfigured extension.
  if grep -q "PLACEHOLDER_" "$CFG"; then
    echo "✗ ERROR: PLACEHOLDER_* still present in config.json after substitution:" >&2
    grep "PLACEHOLDER_" "$CFG" >&2
    rm -rf "$STAGE"
    exit 1
  fi

  OUT="$DIST/luko-capture-$name.zip"
  rm -f "$OUT"
  (cd "$STAGE" && zip -rq "$OUT" chrome-extension)
  echo "  ✓ $OUT ($(du -h "$OUT" | cut -f1))"

  rm -rf "$STAGE"
done

echo
echo "Done. 3 zips ready in $DIST:"
ls -lh "$DIST"/luko-capture-*.zip
