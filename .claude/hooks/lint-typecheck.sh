#!/usr/bin/env bash
# PostToolUse (Write|Edit) — warstwa "na edycję" z test-plan.md §5.
# Lint (ESLint --fix, z prettierem) na edytowanym pliku + inkrementalny typecheck całego projektu.
# Exit 2 = błąd blokujący; stderr wraca do kontekstu agenta, żeby sam poprawił trywialny błąd.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT" || exit 0

FILE="$(jq -r '.tool_input.file_path // empty')"
[ -n "$FILE" ] || exit 0
case "$FILE" in
  *.ts|*.tsx|*.astro) ;;
  *) exit 0 ;;
esac
case "$FILE" in "$ROOT"/*) ;; *) exit 0 ;; esac
[ -f "$FILE" ] || exit 0

ESLINT="$ROOT/node_modules/.bin/eslint"
TSC="$ROOT/node_modules/.bin/tsc"
[ -x "$ESLINT" ] && [ -x "$TSC" ] || exit 0

if [ ! -f "$ROOT/.astro/types.d.ts" ]; then
  echo "Brak .astro/types.d.ts — uruchom 'npx astro sync' (typowane reguły ESLint i tsc padną bez niego)." >&2
  exit 2
fi

FAILED=0
OUT=""

LINT_OUT="$("$ESLINT" --fix "$FILE" 2>&1)" || FAILED=1
[ -n "$LINT_OUT" ] && OUT="$OUT
== eslint --fix ${FILE#"$ROOT"/} ==
$LINT_OUT"

mkdir -p "$ROOT/node_modules/.cache"
TS_OUT="$("$TSC" --noEmit --incremental --tsBuildInfoFile "$ROOT/node_modules/.cache/tsc-hook.tsbuildinfo" 2>&1)" || FAILED=1
[ -n "$TS_OUT" ] && OUT="$OUT
== tsc --noEmit ==
$TS_OUT"

if [ "$FAILED" -ne 0 ]; then
  printf '%s\n' "$OUT" | head -c 8000 >&2
  exit 2
fi
exit 0
