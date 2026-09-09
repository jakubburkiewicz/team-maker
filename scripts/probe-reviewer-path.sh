#!/usr/bin/env bash
#
# Kontrola mutacyjna ścieżki recenzenta (`context/foundation/test-plan.md` §2, ryzyko #4).
#
# Nakłada `scripts/probe-reviewer-path.patch` na `src/lib/supabase.ts` — łatka **zrywa propagację
# ciasteczka sesji**: `setAll` przestaje zapisywać ciasteczka, więc logowanie „udaje się"
# (`POST /api/auth/signin` → 302 `/`), ale middleware nie widzi użytkownika i odbija z powrotem
# na `/auth/signin`. Recenzent nie wchodzi. Ani jeden test poniżej e2e nie prowadzi prawdziwego
# słoika ciasteczek przez dwa żądania, więc ta awaria jest ślepym punktem wszystkiego niżej.
#
# UWAGA — KOD WYJŚCIA JEST ODWRÓCONY WOBEC `npx playwright test` W PRZEBIEGU 2:
#   * przebieg 2 czerwony → to jest wynik pożądany (strażnik wiąże)
#   * przebieg 2 zielony  → skrypt kończy się 1 (e2e jest dekoracją)
# Bez tej uwagi przyszły czytelnik uzna zieloną sondę za awarię.
#
# DLACZEGO TRZY PRZEBIEGI I DWA BUILDY (a nie jeden przebieg, jak w §6.2):
#   * `npm run preview` serwuje **skompilowanego workera** i zmienne zamrożone w
#     `dist/server/.dev.vars`. Łatka na `src/` bez przebudowy nie ma **żadnego** skutku —
#     sonda bez `npm run build` byłaby zielona i kłamała.
#   * Sonda e2e ma klasę awarii, której sonda §6.2 nie ma: stojący stos, `.env`, świeżość builda,
#     przeglądarka. Każdy z tych warunków to osobna droga do czerwieni **niepochodzącej od
#     mutacji**. Dlatego przebieg 1 (czysto, ma być zielony) i przebieg 3 (po zdjęciu łatki,
#     ma wrócić do zieleni) — bez nich odwrócony kod wyjścia nie odróżnia mutacji od osprzętu.
#
# Kody wyjścia:
#   0 — wykazano zielony → czerwony → zielony
#   1 — SONDA NIE WIĄŻE: przebieg 2 przeszedł na rozbrojonej propagacji ciasteczka
#   2 — odmowa startu: `src/lib/supabase.ts` ma niezacommitowane zmiany
#   3 — odmowa startu: łatka nie nakłada się czysto
#   4 — przebieg 1 czerwony: e2e jest zepsute **przed** mutacją (osprzęt, nie mutacja)
#   5 — przebieg 3 czerwony: łatka nie zdjęła się czysto
#   6 — odmowa startu: port aplikacji zajęty
#
# Łatka jest zdejmowana w `trap` (EXIT/INT/TERM), nie na końcu szczęśliwej ścieżki — przerwanie
# w połowie zostawiłoby rozbrojoną propagację sesji w drzewie roboczym.
#
# Nie jest podpięty do CI — ten sam powód co przy §6.2: łatanie plików źródłowych na runnerze
# to nowa klasa awarii zielonego builda. Sonda zostaje kryterium ręcznym.
#
# Wymagania wstępne (te same, co dla `npx playwright test`): `npx supabase start`, `.env`
# wskazujące lokalny stos. Strażnik `e2e/stack-guard.ts` odmówi, gdy którekolwiek nie jest spełnione.
#
# Użycie: scripts/probe-reviewer-path.sh   (bez argumentów)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

PATCH="scripts/probe-reviewer-path.patch"
SOURCE="src/lib/supabase.ts"
APP_PORT="${E2E_PORT:-4321}"
PATCH_APPLIED=0
LOG="$(mktemp -t probe-reviewer-path)"

cleanup() {
  if [[ "$PATCH_APPLIED" == "1" ]]; then
    PATCH_APPLIED=0
    if git apply -R "$PATCH"; then
      printf '\n!! Łatka zdjęta, ale dist/ trzyma jeszcze ROZBROJONĄ kompilację.\n' >&2
      printf '   Uruchom `npm run build`, zanim odpalisz cokolwiek przeciwko preview.\n' >&2
    else
      printf '\n!! Nie udało się zdjąć łatki. Cofnij ręcznie: git checkout -- %s\n' "$SOURCE" >&2
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

# ——— Odmowy startu ———

if [[ -n "$(git status --porcelain "$SOURCE")" ]]; then
  printf 'Sonda odmawia startu: %s ma niezacommitowane zmiany.\n' "$SOURCE" >&2
  printf 'Łatka nakłada się na stan z repozytorium — pogodź drzewo, zanim ją nałożysz.\n' >&2
  git status --porcelain "$SOURCE" >&2
  exit 2
fi

if ! git apply --check "$PATCH" 2>/dev/null; then
  printf 'Łatka %s nie nakłada się czysto — rozjechała się z %s.\n' "$PATCH" "$SOURCE" >&2
  printf 'Odśwież ją wobec bieżącego adaptera ciasteczek zamiast pomijać sondę.\n' >&2
  exit 3
fi

if lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Sonda odmawia startu: port %s jest zajęty.\n' "$APP_PORT" >&2
  printf 'Playwright reużyłby ten proces (`reuseExistingServer`), a on serwuje NIEZAŁATANĄ\n' >&2
  printf 'kompilację — sonda zameldowałaby „nie wiąże" przy działającym strażniku.\n' >&2
  printf 'Zatrzymaj proces na porcie %s i uruchom sondę ponownie.\n' "$APP_PORT" >&2
  exit 6
fi

# ——— Przebiegi ———

# Zwraca kod wyjścia `npx playwright test` (albo 90, gdy padła przebudowa); pełne wyjście
# ląduje w $LOG. Funkcja **nie dotyka** `set -e`/`set +e` — robi to wywołujący. Przełączanie
# flagi w środku wywracało powłokę dokładnie wtedy, gdy przebieg 2 czerwienił się zgodnie
# z planem: `set -e` wracało przed `return`, a niezerowy zwrot kończył skrypt bez komunikatu.
run_e2e() {
  npm run build >>"$LOG" 2>&1 || return 90
  npx playwright test >>"$LOG" 2>&1
}

printf '→ Przebieg 1/3: czyste drzewo — e2e ma być ZIELONE (inaczej czerwień pochodzi z osprzętu).\n'
: >"$LOG"
set +e
run_e2e
RUN1=$?
set -e
if [[ "$RUN1" -ne 0 ]]; then
  printf '\n✗ PRZEBIEG 1 CZERWONY: e2e nie przechodzi jeszcze PRZED mutacją.\n' >&2
  printf '  Sonda nie umie odróżnić mutacji od zepsutego osprzętu — napraw najpierw osprzęt\n' >&2
  printf '  (stos, `.env`, świeżość builda, przeglądarka), potem wróć.\n\n' >&2
  cat "$LOG" >&2
  exit 4
fi
printf '  ✓ zielone\n\n'

printf '→ Przebieg 2/3: łatka nałożona + przebudowa — e2e ma być CZERWONE.\n'
git apply "$PATCH"
PATCH_APPLIED=1
: >"$LOG"
set +e
run_e2e
RUN2=$?
set -e
if [[ "$RUN2" -eq 0 ]]; then
  printf '\n✗ SONDA NIE WIĄŻE: e2e przeszło na zerwanej propagacji ciasteczka sesji.\n' >&2
  printf '  Logowanie nie prowadzi do sesji, a żaden test tego nie zauważył — ryzyko #4\n' >&2
  printf '  nie ma pokrycia, mimo zielonego przebiegu.\n\n' >&2
  cat "$LOG" >&2
  exit 1
fi
if [[ "$RUN2" -eq 90 ]]; then
  printf '\n✗ Przebudowa z łatką padła — to nie jest czerwień od mutacji.\n\n' >&2
  cat "$LOG" >&2
  exit 4
fi
printf '  ✓ czerwone. Testy, które padły:\n\n'
grep -E '^[[:space:]]*(✘|[0-9]+\) )' "$LOG" || printf '  (nie udało się wyłuskać nazw — pełne wyjście)\n\n%s\n' "$(cat "$LOG")"
printf '\n'

printf '→ Przebieg 3/3: łatka zdjęta + przebudowa — e2e ma wrócić do ZIELENI.\n'
git apply -R "$PATCH"
PATCH_APPLIED=0
: >"$LOG"
set +e
run_e2e
RUN3=$?
set -e
if [[ "$RUN3" -ne 0 ]]; then
  printf '\n✗ PRZEBIEG 3 CZERWONY: po zdjęciu łatki e2e nie wróciło do zieleni.\n' >&2
  printf '  Drzewo albo build zostały w stanie pośrednim — sprawdź `git status` i przebuduj.\n\n' >&2
  cat "$LOG" >&2
  exit 5
fi
printf '  ✓ zielone\n\n'

printf '✓ SONDA WIĄŻE: zielony → czerwony → zielony. e2e widzi zerwaną propagację sesji.\n'
exit 0
