#!/usr/bin/env bash
#
# Kontrola mutacyjna bariery zapisu drużyny (`context/foundation/test-plan.md` §2, ryzyka #1 i #6).
#
# Nakłada `scripts/probe-save-barrier.patch` na `src/pages/api/teams/index.ts` — łatka **rozbraja
# barierę**: `createTeam` wykonuje się, zanim odmowa `gateTeamSubmission` wróci, więc skład poniżej
# progu zostawia wiersz. Następnie uruchamia `npm test` i wymaga **czerwieni**.
#
# UWAGA — KOD WYJŚCIA JEST ODWRÓCONY WOBEC `npm test`:
#   * `npm test` czerwone  → skrypt kończy się 0   (strażnik wiąże, tak ma być)
#   * `npm test` zielone   → skrypt kończy się !=0 (osprzęt jest dekoracją)
# Bez tej uwagi przyszły czytelnik uzna zieloną sondę za awarię.
#
# Łatka jest zdejmowana w `trap` (EXIT/INT/TERM), nie na końcu szczęśliwej ścieżki — przerwanie
# w połowie zostawiłoby rozbrojoną trasę w drzewie roboczym. Skrypt odmawia startu na brudnym
# `src/pages/api/teams/` i przerywa niezerowo, gdy łatka nie nakłada się czysto (rozjazd
# z `index.ts` ma być głośny, nie cichy).
#
# Nie jest podpięty do CI: łatanie plików źródłowych na runnerze to nowa klasa awarii zielonego
# builda. Sonda zostaje kryterium ręcznym.
#
# Użycie: scripts/probe-save-barrier.sh   (bez argumentów)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

PATCH="scripts/probe-save-barrier.patch"
ROUTE_DIR="src/pages/api/teams/"
PATCH_APPLIED=0
LOG="$(mktemp -t probe-save-barrier)"

cleanup() {
  if [[ "$PATCH_APPLIED" == "1" ]]; then
    PATCH_APPLIED=0
    if ! git apply -R "$PATCH"; then
      printf '!! Nie udało się zdjąć łatki. Cofnij ręcznie: git checkout -- %s\n' "$ROUTE_DIR" >&2
    fi
  fi
  rm -f "$LOG"
}

on_signal() {
  cleanup
  exit 130
}

trap cleanup EXIT
trap on_signal INT TERM

if [[ -n "$(git status --porcelain "$ROUTE_DIR")" ]]; then
  printf 'Sonda odmawia startu: %s ma niezacommitowane zmiany.\n' "$ROUTE_DIR" >&2
  git status --porcelain "$ROUTE_DIR" >&2
  exit 2
fi

if ! git apply --check "$PATCH" 2>/dev/null; then
  printf 'Łatka %s nie nakłada się czysto — rozjechała się z src/pages/api/teams/index.ts.\n' "$PATCH" >&2
  printf 'Odśwież ją wobec bieżącej trasy zamiast pomijać sondę.\n' >&2
  exit 3
fi

git apply "$PATCH"
PATCH_APPLIED=1

printf '→ Bariera rozbrojona (%s). Uruchamiam npm test…\n\n' "$PATCH"

set +e
npm test >"$LOG" 2>&1
TEST_STATUS=$?
set -e

if [[ "$TEST_STATUS" -eq 0 ]]; then
  printf '\n✗ SONDA NIE WIĄŻE: npm test przeszedł na rozbrojonej barierze.\n' >&2
  printf '  Zapis wykonuje się przed odmową, a żaden test tego nie zauważył.\n\n' >&2
  cat "$LOG" >&2
  exit 1
fi

printf '\n✓ Strażnik wiąże — npm test padł na rozbrojonej barierze. Testy, które padły:\n\n'
grep -E '^[[:space:]]*(×|FAIL)' "$LOG" || printf '  (nie udało się wyłuskać nazw — pełne wyjście poniżej)\n\n%s\n' "$(cat "$LOG")"
printf '\n'
exit 0
