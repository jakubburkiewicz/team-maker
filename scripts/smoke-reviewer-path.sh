#!/usr/bin/env bash
#
# Dym ścieżki recenzenta przeciwko PRODUKCJI (`context/foundation/test-plan.md` §2, ryzyko #4).
#
# DLACZEGO TEN SKRYPT ISTNIEJE — I DLACZEGO NIE JEST TESTEM:
# Człon „rejestracja w produkcji zostawia recenzenta **wylogowanym**, a kliknięcie linku z listu
# też go nie loguje" nie ma automatu i nie będzie go miał. Lokalny stos ma
# `GOTRUE_MAILER_AUTOCONFIRM=true` wpieczone w kontener, więc rejestracja tam **loguje** —
# asercja na tym byłaby fałszywym dowodem. Automat oparty na zapisie do `auth.users` przeszedł
# w badaniu, ale asercjonuje GoTrue, nie aplikację, i nie pokrywa wylądowania recenzenta.
# Do tego aplikacja nie ma szwu na wymianę kodu (zero `exchangeCodeForSession`), więc nie ma
# w kodzie miejsca, w które dałoby się wbić asercję.
#
# Stąd kształt hybrydowy: co da się wykonać bez skrzynki pocztowej, skrypt wykonuje sam;
# reszty **wymusza** na człowieku, odmawiając zakończenia zerem bez oddanego dowodu.
# „Dym wykonany" ma być stanem obserwowalnym, nie zdaniem w planie.
#
# KADENCJA: **przed oddaniem projektu recenzentowi**, nie przy każdym scaleniu.
# Persona główna wchodzi **raz**. Każdy przebieg zakłada trwałe konto w produkcyjnej bazie
# i wysyła realny list — a produkcja ma limit `email_sent = 2` (lokalnie nadpisany na 360000).
# Dlatego usunięcie konta jest **krokiem tego skryptu**, nie osobnym zadaniem do zapamiętania:
# pozycja „Konto testowe w produkcyjnej bazie" stoi otwarta w `context/deployment/deploy-plan.md`
# od 2026-08-30 i od tamtej pory urosła.
#
# Kody wyjścia:
#   0 — dym wykonany: trzy sondy zielone, dowód wylądowania przyjęty, konto usunięte
#   1 — sonda bezmailowa padła (produkcja nie zachowuje się jak powinna)
#   2 — brak terminala: nie ma jak oddać dowodu, więc nie ma dymu
#   3 — dowód wylądowania odrzucony (zły host albo brak `code=`)
#   4 — konto testowe niepotwierdzone jako usunięte
#
# Użycie:
#   scripts/smoke-reviewer-path.sh                      # domyślny adres produkcyjny
#   scripts/smoke-reviewer-path.sh https://inny.adres   # albo PROD_URL=https://… w środowisku
#   scripts/smoke-reviewer-path.sh --check-landing <adres>
#       Sama walidacja dowodu wylądowania: 0 gdy adres jest wiarygodny, 3 gdy nie. Bez sieci
#       i bez bram interaktywnych. Istnieje po to, żeby kryterium „zły adres → niezerowo" dało
#       się związać automatem — pełny przebieg odmawia wcześniej kodem 2 (brak terminala),
#       więc bez tego trybu oba kryteria opierałyby się na jednej barierze.

set -uo pipefail

# ——— Tryb bezstanowy `--check-landing <adres>` ———
# Waliduje sam dowód wylądowania i wychodzi: 0 gdy adres jest poprawny, 3 gdy nie. Bez sieci,
# bez bram interaktywnych. Powód: brama `[[ ! -t 0 ]]` niżej odcina PRZED `read`, więc walidacja
# adresu jest dla automatu nieosiągalna — kryterium „zły adres → niezerowo" przechodziłoby na
# dowodzie należącym do kryterium „brak terminala → niezerowo", czyli na jednej barierze zamiast
# dwóch (`lessons.md` §„Strażnik musi mierzyć to, co deklaruje"). Ten tryb rozdziela je z powrotem.
CHECK_LANDING_ONLY=0
CHECK_LANDING_ARG=""
if [[ "${1:-}" == "--check-landing" ]]; then
  CHECK_LANDING_ONLY=1
  CHECK_LANDING_ARG="${2:-}"
  set -- # zdejmij oba argumenty, żeby PROD_URL wziął wartość ze środowiska albo domyślną
fi

PROD_URL="${1:-${PROD_URL:-https://team-maker.jakub-e9b.workers.dev}}"
PROD_URL="${PROD_URL%/}"
PROD_HOST="$(printf '%s' "$PROD_URL" | sed -E 's#^https?://##; s#/.*##')"

# Limity czasu, nie tylko na awarię sieci: host, który przyjmuje połączenie i milczy (zablokowany
# edge, firewall) zawiesiłby dym bez końca — a jest to skrypt uruchamiany ręcznie przed oddaniem
# projektu. `e2e/stack-guard.ts` używa w tym celu `AbortSignal.timeout`; tu odpowiednikiem są te dwa.
CURL_TIMEOUTS=(--connect-timeout 5 --max-time 20)

PASSED=0
FAILED=0

# Wypisuje werdykt na wiersz — kształt tabel §3 i §5 `deploy-plan.md`.
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf '  ✓ %-46s %s\n' "$label" "$actual"
    PASSED=$((PASSED + 1))
  else
    printf '  ✗ %-46s %s (oczekiwano: %s)\n' "$label" "$actual" "$expected"
    FAILED=$((FAILED + 1))
  fi
}

# Zwraca 0, gdy adres jest wiarygodnym dowodem wylądowania; 1 wraz z komunikatem, gdy nie jest.
# Jedno źródło prawdy dla obu wywołań: bramy ręcznej i trybu `--check-landing`.
validate_landing() {
  local landing="$1" landing_host

  if [[ -z "$landing" ]]; then
    printf '\n✗ Pusty adres — dowód nieoddany.\n' >&2
    return 1
  fi

  landing_host="$(printf '%s' "$landing" | sed -E 's#^https?://##; s#[/?].*##')"

  if [[ "$landing" != http://* && "$landing" != https://* ]]; then
    printf '\n✗ To nie jest adres absolutny. Wklej całą zawartość paska adresu.\n' >&2
    return 1
  fi

  if [[ "$landing_host" != "$PROD_HOST" ]]; then
    printf '\n✗ Adres jest na hoście „%s", a dym dotyczy „%s".\n' "$landing_host" "$PROD_HOST" >&2
    printf '  Wylądowanie na cudzym hoście znaczy, że `site_url` projektu wskazuje gdzie indziej.\n' >&2
    return 1
  fi

  if [[ "$landing" != *"code="* ]]; then
    printf '\n✗ W adresie nie ma parametru `code=`.\n' >&2
    printf '  Link potwierdzający ma prowadzić na `/?code=…` (kształt zapisany z produkcji\n' >&2
    printf '  w deploy-plan.md §6). Brak `code=` znaczy, że tor potwierdzania wygląda inaczej,\n' >&2
    printf '  niż zakłada dokumentacja — to jest ustalenie, nie literówka.\n' >&2
    return 1
  fi

  printf '  ✓ Dowód wylądowania przyjęty (host %s, parametr code obecny).\n\n' "$landing_host"
}

if [[ "$CHECK_LANDING_ONLY" == "1" ]]; then
  validate_landing "$CHECK_LANDING_ARG" || exit 3
  exit 0
fi

printf '\nDym ścieżki recenzenta → %s\n\n' "$PROD_URL"
printf 'Sondy bezmailowe (wykonuje skrypt):\n'

# 1. Strona główna jest chroniona — niezalogowany odwiedzający trafia na logowanie (FR-004).
ROOT="$(curl -s "${CURL_TIMEOUTS[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' "$PROD_URL/")"
check "GET / → 302 na /auth/signin" "302 $PROD_URL/auth/signin" "$ROOT"

# 2. Ekran logowania w ogóle się renderuje — bez niego recenzent nie ma jak wejść.
SIGNIN="$(curl -s "${CURL_TIMEOUTS[@]}" -o /dev/null -w '%{http_code}' "$PROD_URL/auth/signin")"
check "GET /auth/signin → 200" "200" "$SIGNIN"

# 3. Logowanie odpowiada odmową na złe dane, a nie 5xx ani 403.
#    Nagłówek `Origin` jest WYMAGANY: `security.checkOrigin` odbija POST bez niego kodem 403,
#    zanim kod trasy się wykona (`deploy-plan.md` → Odkrycia poza zakresem badań).
#    Bez tego nagłówka ta sonda mierzyłaby CSRF, nie logowanie.
BAD_LOGIN="$(curl -s "${CURL_TIMEOUTS[@]}" -o /dev/null -w '%{http_code} %{redirect_url}' \
  -X POST "$PROD_URL/api/auth/signin" \
  -H "Origin: $PROD_URL" \
  --data-urlencode "email=smoke-$(date +%s)@example.com" \
  --data-urlencode "password=definitely-not-the-password")"
check "POST /api/auth/signin (złe dane) → 302 + błąd" \
  "302 $PROD_URL/auth/signin?error=Invalid%20login%20credentials" "$BAD_LOGIN"

printf '\n  %d/3 sond bezmailowych przeszło.\n\n' "$PASSED"

if [[ "$FAILED" -ne 0 ]]; then
  # `%{http_code}` = 000 znaczy „curl nie dostał odpowiedzi" — DNS, brak łączności, timeout.
  # Bez tego rozróżnienia padnięta sieć operatora wygląda dokładnie jak padnięta produkcja,
  # a komunikat wskazuje winnego fałszywie.
  if [[ "$ROOT" == 000* && "$SIGNIN" == 000* && "$BAD_LOGIN" == 000* ]]; then
    printf '✗ Brak łączności z %s — żadna z trzech sond nie dostała odpowiedzi.\n' "$PROD_HOST" >&2
    printf '  To NIE jest werdykt o produkcji: sprawdź sieć, DNS i czy adres jest właściwy.\n' >&2
    exit 1
  fi
  printf '✗ Produkcja nie zachowuje się jak powinna — nie ma sensu iść dalej ręcznie.\n' >&2
  exit 1
fi

# ——— Brama ręczna ———

cat <<STEPS
Kroki, których skrypt NIE umie wykonać (skrzynka pocztowa) — zrób je teraz w przeglądarce.
Każdy adres jest podany w całości: nie zgaduj i nie otwieraj localhosta.

  1. Otwórz $PROD_URL/auth/signup i załóż konto na adresie e-mail,
     który KONTROLUJESZ — na ten adres przyjdzie list. Hasło: min. 6 znaków.
  2. Potwierdź dwie rzeczy naraz: widzisz ekran „Check your email", a w nowej karcie
     $PROD_URL/ ODBIJA Cię na /auth/signin. To drugie jest dowodem,
     że rejestracja NIE zalogowała — człon, którego żaden automat nie pokrywa, bo na
     lokalnym stosie rejestracja loguje.
  3. Otwórz list i kliknij link potwierdzający.
  4. ZANOTUJ ADRES, NA KTÓRYM WYLĄDOWAŁEŚ — skopiuj cały pasek adresu. Skrypt go za chwilę
     poprosi. Oczekiwany kształt: $PROD_URL/?code=…
  5. Potwierdź, że kliknięcie linku też Cię NIE zalogowało: otwórz $PROD_URL/
     i sprawdź, że nadal odbija na logowanie. Potem zaloguj się ręcznie danymi z kroku 1.
  6. Po zalogowaniu $PROD_URL/ ma pokazać listę drużyn. Na świeżym koncie
     jest ona pusta — poprawny widok to wyjaśnienie i wezwanie „załóż pierwszą drużynę",
     a nie zero wyników ani odbicie na logowanie.

STEPS

if [[ ! -t 0 ]]; then
  printf '✗ Brak terminala — nie ma jak oddać dowodu wylądowania.\n' >&2
  printf '  Dym bez dowodu nie jest dymem wykonanym, więc skrypt kończy się niezerowo.\n' >&2
  printf '  Uruchom go interaktywnie.\n' >&2
  exit 2
fi

printf 'Wklej adres, na którym wylądowałeś po kliknięciu linku z listu: '
read -r LANDING

validate_landing "$LANDING" || exit 3

# ——— Druga brama: sprzątanie ———

cat <<'CLEANUP'
Zostało konto testowe w PRODUKCYJNEJ bazie. Usuń je teraz — panel Supabase →
Authentication → Users → usuń konto założone przed chwilą, a przy okazji konta pozostałe
po wcześniejszych zmianach (m.in. macierz dwóch kont z `cross-account-team-isolation`).

CLEANUP

printf 'Czy konto testowe (i pozostałości po poprzednich zmianach) zostały usunięte? [yes/nie]: '
read -r DELETED

if [[ "$DELETED" != "yes" ]]; then
  printf '\n✗ Konto testowe zostaje w produkcyjnej bazie.\n' >&2
  printf '  To jest pozycja długu „Konto testowe w produkcyjnej bazie" z deploy-plan.md,\n' >&2
  printf '  otwarta od 2026-08-30 i rosnąca z każdą zmianą, która jej nie domyka.\n' >&2
  printf '  Usunięcie konta jest krokiem TEGO skryptu — nie zadaniem na potem.\n' >&2
  exit 4
fi

printf '\n✓ DYM WYKONANY: 3/3 sond, ścieżka przejścia potwierdzona, konto testowe usunięte.\n'
printf '  Ryzyko #4 ma pokrycie na członie, którego automat nie sięga.\n\n'
exit 0
