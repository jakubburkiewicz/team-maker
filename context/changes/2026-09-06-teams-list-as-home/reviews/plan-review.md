<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: lista drużyn na stronie głównej zamiast dashboardu i osobnej trasy `/teams`

- **Plan**: `context/changes/2026-09-06-teams-list-as-home/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: DO POPRAWY → **SOLIDNY** po triażu (6/6 ustaleń naprawionych)
- **Ustalenia**: 3 krytyczne, 2 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt (przed triażem) | Po triażu |
|---|---|---|
| Zgodność ze stanem końcowym | NIEZALICZONY | ZALICZONY |
| Oszczędne wykonanie | ZALICZONY | ZALICZONY |
| Dopasowanie architektoniczne | OSTRZEŻENIE | ZALICZONY |
| Martwe punkty | NIEZALICZONY | ZALICZONY |
| Kompletność planu | OSTRZEŻENIE | ZALICZONY |

## Ugruntowanie

12/12 ścieżek ✓ (13. `src/lib/routes.ts` nowa), wszystkie cytowane numery linii ✓, brief↔plan ✓.
Kontrakt `## Progress` ✓ (jeden nagłówek, 3↔3 fazy, kryteria 1:1 z punktami Progress, zero
checkboxów w blokach faz). Strażniki grepowe uruchomione dosłownie: 2.3 i kotwica `href="…"`
przechodzą; 1.4 i 3.1 były czerwone (F3, F1).
Drobny dryf bez wpływu, zostawiony: `signin.ts:20` jest faktycznie `:19`; linki karty sukcesu
w `embark.astro` zaczynają się na `:74`, nie `:77`.

## Ustalenia

### F1 — `Topbar.astro:13` zostawia `href="/dashboard"`; kryterium 3.1 nie może być zielone

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: Faza 3 pkt 1 + Progress 3.1
- **Szczegóły**: Plan wymienia `src/components/Topbar.astro:13` w §Analiza stanu obecnego, ale Faza 3
  pkt 1 go pomija (lista: `new.astro`, `[id].astro`, `embark.astro`, `TeamNotFound.astro`). Strażnik
  uruchomiony na drzewie po Fazie 2 zwraca to jedno trafienie → 3.1 czerwone, a stan końcowy „żadna
  strona nie linkuje już do `/dashboard`" nieosiągnięty.
- **Poprawka A ⭐ Zalecana**: dopisz `Topbar.astro:13` do Fazy 3 pkt 1 (`href="/"`, etykieta „Your teams").
  - Siła: jedna linia, strażnik zielony bez wyjątku; plik i tak ginie w planie siostrzanym.
  - Kompromis: dotykasz pliku, którego kasację deklaruje inny plan — ale edycja `href` z nią nie koliduje.
  - Pewność: WYSOKA — grep uruchomiony, jedyne pozostałe trafienie.
- **Poprawka B**: zostaw Topbar, wyłącz go ze strażnika 3.1.
  - Kompromis: wyjątek w strażniku negatywnym — klasa dziury z lekcji o strażnikach grepowych.
- **Decyzja**: NAPRAWIONE poprawką A

### F2 — Po Fazie 2 nie ma w interfejsie żadnego wyjścia „Sign out" (FR-003)

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 pkt 3 + Progress 2.12 + krok 11 testów ręcznych
- **Szczegóły**: Formularz signout żyje dziś wyłącznie w `Topbar.astro:19` (renderowany tylko przez
  `Welcome.astro:28`) i `dashboard.astro:31`. Faza 2 kasuje oba konsumenty, a przenoszona treść listy
  formularza nie zawiera. FR-003 („musi być") traci jedyną ścieżkę w UI aż do
  `app-shell-header-nav` §Faza 2, a kryterium ręczne 2.12 i krok 11 stają się niewykonalne.
- **Poprawka A ⭐ Zalecana**: formularz signout w nagłówku przenoszonego `index.astro`, kształt
  skopiowany z `Topbar.astro:19-23`, jako jawna czwarta kategoria zmian Fazy 2 pkt 1.
  - Siła: domyka FR-003 w tym samym commicie; bramka ręczna wykonalna.
  - Kompromis: łamie „treść przenosi się dosłownie" — nazwane wprost w §Umowie.
  - Pewność: WYSOKA — trasa `/api/auth/signout` bez zmian, jej przekierowanie na `/` odbija na logowanie.
- **Poprawka B**: przyjąć lukę i przepisać kroki ręczne na `POST` z devtools.
  - Kompromis: recenzent zobaczy produkt bez wylogowania, jeśli plan siostrzany się opóźni.
- **Decyzja**: NAPRAWIONE poprawką A (nowy strażnik 2.3, Progress Fazy 2 przenumerowany do 2.16)

### F3 — Kryterium 1.4 trafia w komentarz, który sam plan każe napisać

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 pkt 1 (fragment kontraktu) + kryterium / Progress 1.4
- **Szczegóły**: Faza 1 dyktuje komentarz zawierający literalnie `"/auth/signin".startsWith("/")`,
  a kryterium 1.4 brzmi `! grep -n 'startsWith("/")' src/lib/routes.ts`. Moduł zbudowany wg umowy
  i strażnik uruchomiony dosłownie → trafienie w ten komentarz, 1.4 czerwone. Wprost lekcja
  „Kryteria grepowe kotwicz na składni, nie na słowach — komentarze też są w pliku". Dodatkowo
  strażnik nie łapie pułapki, którą nazywa: `"/"` w tablicy prefiksów + `startsWith(route)` nie
  zawiera tego literału — regułę wiąże wyłącznie test (1.1).
- **Poprawka**: ostrzyż komentarze przed dopasowaniem —
  `! grep -vE '^\s*//' src/lib/routes.ts | grep -n 'startsWith("/")'`; w §Umowie zapisz, że test 1.1
  jest jedyną barierą dla wariantu tablicowego.
- **Decyzja**: NAPRAWIONE (obie próby przebiegły: strażnik przechodzi na module wg umowy i nadal
  wykrywa naiwny `startsWith("/")` w kodzie)

### F4 — Krok ręczny „zdejmij klucze Supabase" nie dosięga gałęzi awarii

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Progress 3.11 (obecnie 3.12) + krok 12 testów ręcznych
- **Szczegóły**: Bez kluczy `createClient()` zwraca `null` → middleware ustawia `user = null` →
  `/teams/new` i `/teams/<uuid>` są chronione → 302 na `/auth/signin`; frontmatter nigdy się nie
  wykona. Kod mówi to wprost w `new.astro:20`, `embark.astro:26` i `teams/index.astro:35` — plan
  cytuje jedno z tych zdań, a mimo to przepisuje metodę, która na przeciwnym założeniu polega.
  Karty awarii (`new.astro:57`, `[id].astro:146`, `embark.astro:93`) włącza rzut z repo.
- **Poprawka A ⭐ Zalecana**: sonda — tymczasowy `throw new Error("probe")` w `getCharacterPool`
  i `getTeamSummary`, cofany przed commitem; sesja żyje, `catch` renderuje kartę.
  - Kompromis: ręczna edycja źródła w trakcie weryfikacji → dodany osobny punkt Progress na cofnięcie.
- **Poprawka B**: skreślić krok i zapisać jako przyjęte ryzyko.
- **Decyzja**: NAPRAWIONE poprawką A (nowe punkty 3.12 i 3.13; §Otwarte ryzyka w brief zaktualizowane)

### F5 — `AGENTS.md:33` po zmianie kłamie o mechanizmie ochrony tras

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 3 pkt 2 + plan-brief §Sprzątanie poza `src/`
- **Szczegóły**: Plan deklarował README jako „jedyny plik poza kodem, który po zmianie kłamie".
  `AGENTS.md:33` („Protect a route by adding its path to `PROTECTED_ROUTES` in `src/middleware.ts`")
  wskazuje po Fazie 2 na nieistniejącą tablicę, a jest to plik czytany przed kodem (`CLAUDE.md:1`) —
  następna zmiana dostałaby instrukcję odtworzenia skasowanego wzorca. `AGENTS.md:24` zostaje prawdziwe.
- **Poprawka**: `AGENTS.md:33` w zakresie Fazy 3 pkt 2 (wskazać `isProtectedRoute` w `src/lib/routes.ts`,
  nazwać rozróżnienie dokładne/prefiksowe) + kryterium `! grep -n "PROTECTED_ROUTES" AGENTS.md README.md`.
- **Decyzja**: NAPRAWIONE (nowy punkt 3.3; Progress Fazy 3 przenumerowany do 3.13)

### F6 — „Czego NIE robimy" opisuje przyciski, których na liście nie ma

- **Waga**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: §Czego NIE robimy
- **Szczegóły**: „Nie zmieniamy przycisków na pozycjach listy" sugeruje ich istnienie;
  `teams/index.astro:113-123` renderuje pozycje jako zwykłe `<a>`, a `team-action-buttons` dopiero je doda.
- **Poprawka**: przeformułowanie na „nie dodajemy" wraz z cytatem linii.
- **Decyzja**: NAPRAWIONE

## Sprawdzone i przeszło

- Kontrakt `## Progress` (jeden nagłówek, 3↔3 fazy, kryteria 1:1, zero `- [ ]` w blokach faz).
- Kryterium 2.3 (`client:[a-z]+`) uruchomione nad przenoszoną treścią — komentarz „zero `client:*`"
  z `teams/index.astro:29` nie trafia; lekcja S-06 zastosowana poprawnie.
- Kotwica `href="/teams"` nie łapie `href="/teams/new"` ani polskich komentarzy o `/teams`.
- Wszystkie 13 cytowanych numerów linii; brak `src/pages/404.astro` nie przeszkadza (domyślne 404 Astro).
- `isProtectedRoute` z granicą segmentu obejmuje warianty z ukośnikiem końcowym, które plan siostrzany
  wskazuje jako ryzyko (`astro.config.mjs` nie ustawia `trailingSlash`).
