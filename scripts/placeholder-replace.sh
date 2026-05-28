#!/usr/bin/env bash
# =============================================================================
# scripts/placeholder-replace.sh  <subdom> [--dry-run]
# Cienki wrapper - odpala placeholder-replace.py przez ~/waas-venv/bin/python
# (venv zawiera gspread + requests, system pip blokowany przez PEP 668).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$HOME/waas-venv/bin/python"
APP="$SCRIPT_DIR/placeholder-replace.py"

if [[ ! -x "$PY" ]]; then
  echo "BLAD: brak $PY" >&2
  echo "      utworz venv:  python3 -m venv ~/waas-venv && ~/waas-venv/bin/pip install gspread" >&2
  exit 1
fi
if [[ ! -f "$APP" ]]; then
  echo "BLAD: brak $APP (oczekiwany obok tego wrappera)" >&2
  exit 1
fi

exec "$PY" "$APP" "$@"
