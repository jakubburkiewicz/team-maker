<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: lista drużyn na stronie głównej zamiast dashboardu i osobnej trasy `/teams`

- **Plan**: `context/changes/2026-09-06-teams-list-as-home/plan.md`
- **Zakres**: Fazy 1–3 z 3 (pełny przegląd planu; 34/34 pozycji Progress `[x]`)
- **Data**: 2026-09-06
- **Werdykt**: WYMAGA UWAGI (triaż zamknięty 2026-09-06: F1, F3, F4 naprawione; F2 pominięte)
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar                 | Werdykt |
| ---------------------- | ------- |
| Zgodność z planem      | PASS    |
| Dyscyplina zakresu     | PASS    |
| Bezpieczeństwo i jakość | PASS    |
| Architektura           | WARNING |
| Spójność wzorców       | WARNING |
| Kryteria sukcesu       | WARNING |

## Weryfikacja kryteriów sukcesu

Wszystkie kryteria automatyczne uruchomione **dosłownie** — komplet zielony:

| Kryterium | Wynik |
| --- | --- |
| 1.2–1.4, 2.1–2.6, 3.1–3.3, 3.7 (strażniki grepowe) | pass (13/13) |
| 1.1 / 2.7 / 3.4 `npm test` | pass — 155 testów, 14 plików |
| 1.5 / 2.8 / 3.5 `npm run lint` | pass — exit 0 |
| 1.6 / 2.9 / 3.6 `npm run build` | pass |
| 3.13 `git diff src/lib/` czysty | pass |

Kryteria ręczne (2.10–2.16, 3.8–3.13) mają pokrycie w diffie. Dodatkowo sonda empiryczna na
`npm run dev` (port 4331, bez sesji) potwierdziła kryteria 2.11 i 2.16 oraz brak pętli przekierowań:
`/` → 302 `/auth/signin`, `/auth/signin` → 200, `/dashboard` → 404.

## Ustalenia

### F1 — Trzy komentarze w `src/pages/api/` odsyłają do skasowanego `PROTECTED_ROUTES`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/pages/api/teams/index.ts:30`, `src/pages/api/teams/[id].ts:49`, `src/pages/api/teams/[id]/delete.ts:51`
- **Szczegóły**: Tablica `PROTECTED_ROUTES` nie istnieje już nigdzie w repozytorium, ale trzy
  komentarze „obrona w głąb" wciąż ją nazywają jako źródło ochrony trasy. Plan **poprawnie**
  zaktualizował `AGENTS.md:33` z uzasadnieniem „nietknięty kazałby następnej zmianie odtworzyć
  skasowaną tablicę" — dokładnie to samo rozumowanie stosuje się do komentarzy w kodzie, których
  plan nie wymienił. Strażnik 2.5 był zawężony do jednego pliku (`! grep -n "PROTECTED_ROUTES"
  src/middleware.ts`), a 3.3 tylko do `AGENTS.md README.md`; żaden nie objął `src/`. To jest wprost
  lekcja „Kryteria grepowe kotwicz na składni, nie na słowach": strażnik zielony, intencja
  niespełniona, bo zakres greppa był węższy niż klasa problemu.
- **Poprawka**: Zmień w trzech komentarzach `PROTECTED_ROUTES` na `isProtectedRoute()` w `src/lib/routes.ts`, a strażnik w planie rozszerz do `! grep -rn "PROTECTED_ROUTES" src/`.
- **Decyzja**: FIXED — komentarze w trzech trasach API wskazują `isProtectedRoute()` w `src/lib/routes.ts`; `! grep -rn "PROTECTED_ROUTES" src/` zielone

### F2 — Model ochrony jest listą odmów, a PRD opisuje listę dozwoleń

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔬 WYSOKI — stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Architektura
- **Lokalizacja**: `src/lib/routes.ts:16,22`
- **Szczegóły**: `EXACT_ROUTES = ["/"]` i `PREFIX_ROUTES = ["/teams", "/api/teams"]` wyliczają to,
  co **chronione** — wszystko inne jest domyślnie publiczne. PRD mówi odwrotnie: FR-004 „przekierowywany
  na ekran logowania **z każdej trasy aplikacji**", a §Access Control „Nie ma publicznej strony
  powitalnej ani trybu gościa". Dziś pokrycie jest kompletne — zweryfikowane na wszystkich 13 trasach
  w `src/pages/` — ale ta zmiana skasowała **ostatnią** publiczną stronę (`Welcome.astro`), więc zbiór
  publiczny skurczył się do `/auth/*` i `/api/auth/*` i już nie urośnie. Przy takim rozkładzie
  domyślna wartość jest odwrócona: nowy `src/pages/profile.astro` będzie otwarty, dopóki ktoś nie
  dopisze go do tablicy — awaria cicha, tej samej klasy co pułapka `/`, którą Faza 1 wiąże testem.
  `AGENTS.md:33` po tej zmianie **kodyfikuje** ten kierunek („Protect a route by adding its path…"),
  więc następna zmiana go powtórzy. Żadna strona nie ma własnego sprawdzenia `locals.user` — trasy
  `.astro` polegają w całości na middleware plus RLS.
- **Poprawka A ⭐ Zalecane**: Odwróć na `PUBLIC_ROUTES = ["/auth", "/api/auth"]` (prefiks po granicy segmentu) i `isProtectedRoute = (p) => !isPublicRoute(p)`.
  - Siła: Domyślna wartość zaczyna zgadzać się z FR-004 i §Access Control; nowa trasa jest chroniona,
    zanim ktokolwiek o niej pomyśli. Test odwraca się jeden do jednego (te same literały, przeciwne
    wartości) i zyskuje asercję „nieznana trasa `/whatever` jest chroniona", której dziś nie ma.
  - Kompromis: Zmiana w warstwie autoryzacji tuż po jej wdrożeniu; wymaga ponownej weryfikacji ręcznej
    pętli przekierowań i aktualizacji `AGENTS.md:33` po raz drugi w jednym dniu.
  - Pewność: WYSOKA — zweryfikowane, że plany siostrzane (`app-shell-header-nav`,
    `team-action-buttons`) nie dotykają `src/lib/routes.ts`; `app-shell-header-nav` tworzy własny
    `src/lib/nav.ts`. Inwersja jest wolna od konfliktu między planami.
  - Martwy punkt: Nie sprawdzono, czy przyszłe trasy publiczne (np. health-check, webhook Supabase)
    są planowane — jeśli tak, allow-lista wymagałaby dopisywania wyjątków.
- **Poprawka B**: Zostaw deny-listę, ale zapisz decyzję jawnie — komentarz w `src/lib/routes.ts` i zdanie w `AGENTS.md:33` nazywające domyślną wartość „trasa jest publiczna, dopóki nie zostanie dopisana".
  - Siła: Zero ryzyka regresji w warstwie autoryzacji; utrwala to, co plan świadomie wybrał, i odbiera
    następnemu agentowi konieczność odkrywania pytania od nowa.
  - Kompromis: Cicha awaria zostaje — komentarz nie jest barierą, a `AGENTS.md` bywa czytany
    wybiórczo. Ryzyko przyjęte, nie usunięte.
  - Pewność: ŚREDNIA — skuteczność zależy od tego, czy kolejna zmiana faktycznie przeczyta regułę.
  - Martwy punkt: Nie oszacowano, ile nowych tras powstanie przed końcem projektu.
- **Decyzja**: SKIPPED — deny-lista zostaje bez zmian i bez dopisanego uzasadnienia; ryzyko cichego otwarcia nowej trasy przyjęte świadomie

### F3 — `README.md` nie przechodzi `prettier --check`

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `README.md:143`
- **Szczegóły**: Nowy wiersz tabeli tras (`| \`/\` | Your saved teams — protected … |`) jest dłuższy
  niż separator, a kolumny nie zostały ponownie wyrównane. `npx prettier --check README.md` zgłasza
  warn; `AGENTS.md`, `src/lib/routes.ts`, `src/lib/routes.test.ts` i `src/pages/index.astro`
  przechodzą czysto. CI tego nie łapie — `npm run lint` to eslint, który `.md` nie dotyka, a
  lint-staged (`*.{json,css,md}` → `prettier --write`) najwyraźniej nie zadziałał przy commicie
  `f50b65b`. To jedyny plik w zmianie niezgodny z własnym `.prettierrc.json`.
- **Poprawka**: `npx prettier --write README.md`.
- **Decyzja**: FIXED — `npx prettier --write README.md`; `--check` zielone

### F4 — Brak asercji dla ukośnika końcowego przy prefiksach

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `src/lib/routes.test.ts:24-34`
- **Szczegóły**: `astro.config.mjs` nie nadpisuje `trailingSlash`, więc obowiązuje domyślne `"ignore"`
  i wzorce tras kończą się `\/?$` — `/teams/new/` jest realnie osiągalną trasą (potwierdzone sondą:
  302 na `/auth/signin` bez sesji). Dziś dopasowanie działa, bo `"/teams/new/".startsWith("/teams/")`
  jest prawdą, ale nic tego nie wiąże: przejście na porównanie po segmentach albo `pathname.split("/")`
  zepsułoby to bez czerwonego testu. Poza tym pokrycie testu jest kompletne wobec umowy planu —
  asercje na literałach, przypadek pułapki prefiksu `/` i przypadek granicy segmentu obecne.
- **Poprawka**: Dopisz `expect(isProtectedRoute("/teams/new/")).toBe(true);` do istniejącego `it` „wszystkie trasy drużyn wymagają zalogowania".
- **Decyzja**: FIXED — dopisana asercja `isProtectedRoute("/teams/new/") === true` w `src/lib/routes.test.ts`

## Co zweryfikowano bez ustaleń

- **Szczelność bramki autoryzacji** — sonda empiryczna na działającym `npm run dev` bez sesji na
  jedenastu wariantach zapisu ścieżki (`/teams/`, `/teams/new/`, `//teams/new`, `/teams%2Fnew`,
  `/teams/../teams/new`, `/./teams/new`, `/TEAMS/new`, `/teamsomething`, `//`, `/api/teams/`,
  `/api//teams`). Żaden nie omija middleware: każdy wariant trafiający w realną trasę daje 302 na
  `/auth/signin`, reszta daje 404. Potwierdzone niezależnie analizą źródeł Astro 6 —
  `context.url.pathname` przechodzi przez `normalizeUrl()` (`decodeURI` + zwinięcie duplikatów
  ukośników) przed middleware, a routing przez `#computePathname`; jedyna różnica między nimi działa
  wyłącznie w stronę nadmiaru ochrony.
- **Pokrycie tras** — wszystkie 13 tras w `src/pages/` sprawdzone punktowo; żadna trasa API nie
  straciła ochrony, `/dashboard` zniknął z listy chronionych razem z plikiem.
- **Lista „musi zostać nietknięte" z Fazy 2** — wszystkie 8 pozycji przetrwały co do znaku, łącznie
  z najbardziej podatnymi: `savedAtFormat.format` wewnątrz `try` (`index.astro:48`) i położenie
  banera `?deleted=1` nad obiema gałęziami sukcesu, nigdy nad gałęzią awarii.
- **Dyscyplina zakresu** — diff (17 plików) pokrywa się z listą planu co do pliku; zero zmian
  nieplanowanych. Jedyny dodatek (formularz `Sign out`, `index.astro:65-69`) jest jawnie zaplanowany,
  uzasadniony FR-003 i oznaczony w kodzie jako tymczasowy z odesłaniem do planu siostrzanego.
- **Lekcje projektu** — zero top-level `return` w `.astro`; zero dyrektyw `client:*` na `/`; zmiana
  nie dotyka SQL-a ani migracji.
- **Drobiazg poniżej progu ustalenia** — klasa przycisku `Sign out` (`index.astro:66`) ma `text-sm`,
  którego wzorzec `Topbar.astro:20` nie ma, mimo umowy „klasy skopiowane dosłownie". Token został
  odziedziczony po usuniętym w tym samym slocie linku `← Back to dashboard`, jest wizualnie poprawny,
  a plan siostrzany ten formularz stąd zabiera. Nie kwalifikuję jako ustalenie.
