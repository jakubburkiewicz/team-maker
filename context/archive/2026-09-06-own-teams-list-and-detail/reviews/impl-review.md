<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: lista własnych drużyn i widok zapisanej drużyny (S-04)

- **Plan**: context/changes/own-teams-list-and-detail/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny plan)
- **Data**: 2026-09-06
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | PASS |

## Kryteria sukcesu — weryfikacja

Automatyczne (uruchomione niezależnie w tym przeglądzie):

| Kryterium | Polecenie | Wynik |
|---|---|---|
| 1.1 / 2.2 / 3.2 | `npm test` | PASS — 11 plików, 121 testów |
| 1.2 / 2.1 / 3.1 | `npm run lint` | PASS — exit 0 |
| 1.3 / 2.3 / 3.3 | `npm run build` | PASS — Node 22.14.0, `Complete!` |
| 1.4 | `git diff c68de80..HEAD -- src/lib/team-submission.test.ts` | PASS — diff pusty, plik nietknięty |

Ręczne: wszystkie pozycje 1.5, 2.4–2.8, 3.4–3.8 mają widoczne pokrycie w diffie (importy `team-view.ts`,
trzy stany w `index.astro`, link w `dashboard.astro`, `Astro.response.status = 404`, brak `client:*`
na `[id].astro`, dwa nowe linki w `embark.astro`). Żadna pozycja nie nosi znamion podpisania na ślepo.
Jedyne zastrzeżenie dotyczy 3.6 w scenariuszu degradacji — patrz F2.

## Ustalenia

### F1 — Formatowanie daty w szablonie może wywrócić render listy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (niezawodność)
- **Lokalizacja**: src/pages/teams/index.astro:93
- **Szczegóły**: `Saved {savedAtFormat.format(new Date(team.createdAt))}` wykonuje się w szablonie,
  poza blokiem `try`/`catch` z linii 19–25. `Intl.DateTimeFormat.format` rzuca `RangeError` na
  `Invalid Date`, a nieobsłużony throw w Workerze to 500 (twarda reguła AGENTS.md) — czyli dokładnie
  ten wynik, którego reszta pliku starannie unika, rozróżniając `null` (awaria) od `[]` (nowe konto).
  Prawdopodobieństwo jest niskie (`created_at timestamptz not null default now()`, jedyny pisarz to
  baza), ale ten fragment jako całość opiera się na tezie „nie ufaj kształtowi danych z bazy" —
  `resolveSavedTeam` istnieje właśnie po to.
- **Poprawka**: Sformatować datę w frontmatterze wewnątrz `try`: zmapować `TeamListItem` na
  `{ id, name, savedAt: string }`, tak by szablon dostał gotowy string i nie miał jak rzucić.
- **Decyzja**: FIXED — formatowanie daty przeniesione do frontmattera wewnątrz `try` (`TeamRow { id, name, savedAt }`)

### F2 — Jedna flaga `failed` na dwa niezależne odczyty miesza 404 z awarią puli

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: src/pages/teams/[id].astro:19, 36, 44, 50
- **Szczegóły**: `failed` jest wspólne dla `getTeamDetail` i `getCharacterPool`, a `notFound = !failed
  && team === null` (:50). Gdy pula padnie, nieznane lub cudze `id` daje 200 ze stanem „Team is
  unavailable right now" zamiast 404 — kod odpowiedzi zależy od zapytania niezwiązanego z istnieniem
  wiersza. Kryterium 3.6 („cudze id, losowy UUID i nie-UUID dają 404 nierozróżnialnie") jest spełnione
  w ścieżce normalnej, ale nie w ścieżce degradacji. **Bezpieczeństwo nie jest naruszone**: degradacja
  jest symetryczna — istniejąca i nieistniejąca drużyna dają identyczną stronę, więc nie powstaje kanał
  rozróżnienia i guardrail izolacji trzyma.
- **Poprawka**: Rozdzielić na `teamFailed` / `poolFailed` i liczyć `notFound = !teamFailed && team === null`.
- **Decyzja**: FIXED — flaga zawężona do `teamFailed`; awarię puli niesie już `pool === null`, więc druga flaga byłaby nieczytana

### F3 — Centralna decyzja `resolveSavedTeam` nie jest przybita testem

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (pokrycie testami)
- **Lokalizacja**: src/lib/team-view.test.ts:27-65
- **Szczegóły**: Plan i docstring `team-view.ts:23-26` uzasadniają odrzucanie przy **dowolnym**
  naruszeniu, powołując się wprost na skład z siedmioma członkami („też nie zmieści się w sześciu
  slotach") i na powtórzoną postać. Testy pokrywają wyłącznie `unknown-character` i `unknown-perk`
  plus dwa przypadki przejścia. Zawężenie implementacji do
  `violations.filter((v) => v.kind.startsWith("unknown"))` przeszłoby dziś na zielono, a `resolveSavedTeam`
  jest jedyną barierą, która ma powstrzymać S-05 przed zapisaniem okrojonego składu. Plan wyliczył
  dokładnie te cztery przypadki, więc to nie jest dryf wobec planu — to luka samego planu.
  (Poboczne: przypadek `perkId` spoza puli używa perka innej postaci z puli, nie perka nieistniejącego
  nigdzie — `evaluateTeam` daje ten sam `unknown-perk`, więc intencja jest spełniona, ale węziej.)
- **Poprawka**: Dopisać jeden `it` odrzucający skład siedmiu członków z `TEST_POOL` (naruszenie
  `team-size`, nie `unknown-*`) — trzy linijki, które przybijają „dowolne naruszenie".
- **Decyzja**: FIXED — dopisany `it` odrzucający skład `MAX_TEAM_SIZE + 1` członków z asercją, że żadne naruszenie nie jest `unknown-*` (122 testy zielone)

### F4 — Link „Your teams" na dashboardzie ma inny styl, niż zapisano w umowie

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/pages/dashboard.astro:17, 26
- **Szczegóły**: Plan: „dodać link »Your teams« → `/teams` obok istniejącego »Assemble a new team«,
  **tym samym stylem**. Nic więcej na tej stronie się nie zmienia." Faktycznie nowy link dostał wariant
  drugorzędny (`border border-white/20 bg-white/10`) zamiast stylu wzorca (`bg-purple-600`), a istniejący
  link został owinięty w nowy kontener `<div class="mt-6 flex flex-col items-center gap-3">` i stracił
  własne `mt-6`. Cel (widoczne wejście na listę, kryterium 2.8) jest osiągnięty, a hierarchia
  primary/secondary jest obronna projektowo — odchylenie dotyczy litery umowy.
- **Poprawka**: Zostawić jak jest i dopisać w planie jednozdaniowy dopisek, że S-04 wprowadził
  hierarchię primary/secondary na dashboardzie — albo zrównać style, jeśli umowa ma być literalna.
- **Decyzja**: SKIPPED — hierarchia primary/secondary uznana za lepszą niż litera umowy; kod bez zmian

### F5 — Pusty slot w trybie odczytu dostał etykietę i ramkę spoza umowy

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/components/team/RosterSlot.tsx:60-66
- **Szczegóły**: Plan: „puste sloty renderują nieinteraktywny placeholder (**ta sama przerywana ramka**,
  bez `onClick`, bez hovera i bez etykiety »Recruit«)". Faktycznie ramka jest przygaszona
  (`border-white/10 … text-blue-100/40` vs interaktywne `border-white/20 … text-blue-100/60`), a slot
  dostał nowy tekst `Empty slot`, którego plan nie przewidywał — zakazywał tylko etykiety „Recruit".
  Kryterium 3.5 (brak elementów akcji) jest spełnione; to dodatek czytelnościowy, nie akcja.
- **Poprawka**: Uznać za świadomy dodatek i dopisać do planu — albo zdjąć `Empty slot` i zrównać
  ramkę z wariantem interaktywnym, jeśli umowa ma być literalna.
- **Decyzja**: SKIPPED — etykieta „Empty slot” i przygaszona ramka uznane za zasadny dodatek czytelnościowy; kod bez zmian

### F6 — „`readOnly` ⟺ brak `client:*`" trzymane wyłącznie konwencją

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura
- **Lokalizacja**: src/pages/teams/[id].astro:96-104
- **Szczegóły**: `<TeamComposer pool={pool} initialComposition={composition} readOnly />` bez dyrektywy
  `client:*` — to dwa niezależne przełączniki, które muszą się zgadzać, a nic ich nie wiąże. Rozjechanie
  ich w S-05 (dodane `client:load` bez zdjęcia `readOnly`, albo odwrotnie) daje ekran wyglądający na
  interaktywny i całkowicie martwy, bez sygnału w lincie ani w testach. Decyzja jest udokumentowana
  komentarzem wraz z notą dla S-05, więc ryzyko jest przyszłe, nie bieżące.
- **Poprawka A ⭐ Zalecane**: Zapisać jako powtarzającą się regułę (`/10x-lesson`): „wyspa renderowana
  bez `client:*` i flaga trybu odczytu to jedna zmiana — plan fazy, która dokłada interakcję, ma nazywać
  obie naraz".
  - Siła: Trafia dokładnie tam, gdzie ryzyko się zmaterializuje — do planu S-05, który i tak przeczyta `lessons.md`.
  - Kompromis: Reguła nie egzekwuje się sama; zależy od tego, że kolejny plan zostanie napisany po lekturze lekcji.
  - Pewność: WYSOKA — repo ma już dwie lekcje tej klasy i obie zadziałały (lekcja o top-level `return` została w tym fragmencie zastosowana poprawnie).
  - Martwy punkt: Nie sprawdzono, czy da się to wyrazić regułą lintu.
- **Poprawka B**: Związać przełączniki w kodzie — np. wyprowadzić z `[id].astro` cienki wrapper
  `SavedTeamView`, który nie przyjmuje `readOnly` jako propu, tylko go zaszywa.
  - Siła: Niezmiennik przestaje zależeć od dyscypliny autora następnej fazy.
  - Kompromis: Dokłada komponent poza umową planu i pracę, którą S-05 i tak rozmontuje, podłączając zapis.
  - Pewność: ŚREDNIA — kształt wrappera zależy od tego, jak S-05 poprowadzi zapis, a to jeszcze nie jest rozstrzygnięte.
  - Martwy punkt: Nie przemyślano, jak wrapper współgra z trybem edycji, który S-05 dołoży na tej samej trasie.
- **Decyzja**: ACCEPTED-AS-RULE: Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana, nie dwie

### F7 — Ścieżka odczytu zależy od modułu nazwanego dla zapisu

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/team-repo.ts:4
- **Szczegóły**: `import { toTeamComposition } from "@/lib/team-submission"` — plan świadomie wybrał
  jedną umowę kształtu zamiast dwóch rozjeżdżających się kopii i to jest słuszne, ale nazwa modułu
  opisuje już tylko połowę jego roli. Docstring `team-submission.ts:13-16` sam to przyznaje („moduł jest
  odtąd wspólną umową kształtu składu dla obu kierunków"), co jest obejściem nazwy komentarzem.
- **Poprawka A ⭐ Zalecane**: Zostawić jak jest do czasu S-05/S-06 i wydzielić `src/lib/team-composition.ts`
  dopiero wtedy, gdy konsumentów będzie więcej.
  - Siła: Nie płaci się teraz za refaktor, którego kształt ustalą dopiero kolejne fragmenty; docstring niesie prawdę do tego czasu.
  - Kompromis: Każdy kolejny czytelnik `team-repo.ts` musi przełknąć import z „submission" w ścieżce odczytu.
  - Pewność: WYSOKA — S-05 i S-06 są następne w kolejce i obie dotkną tego modułu.
  - Martwy punkt: Nie sprawdzono, czy plan S-05 przewiduje ten refaktor.
- **Poprawka B**: Wydzielić `src/lib/team-composition.ts` teraz — przenieść tam `toTeamComposition`
  i typ `TeamComposition`, zostawiając w `team-submission.ts` wyłącznie bramkę zapisu.
  - Siła: Nazwa zaczyna odpowiadać roli, zanim dojdą kolejni konsumenci i utrwalą pomyłkę.
  - Kompromis: Zmiana poza umową tego planu, dotyka pliku, którego testy plan kazał zostawić nietknięte.
  - Pewność: ŚREDNIA — zakres jest jasny, ale to praca doliczona do zamkniętego już fragmentu.
  - Martwy punkt: Nie policzono, ile miejsc importuje dziś `TeamComposition` z `team-submission`.
- **Decyzja**: SKIPPED (Poprawka A) — refaktor odroczony do S-05/S-06; zakolejkowany w `follow-ups/review-fixes.md`

### F8 — Cały model izolacji zależy od tego, że `SUPABASE_KEY` nie jest kluczem `service_role`

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/team-repo.ts:129 (oraz supabase/migrations/20260905185700_teams_schema.sql:37-39)
- **Szczegóły**: `listTeams` i `getTeamDetail` celowo nie filtrują po `user_id` — własność egzekwuje
  polityka `select` RLS (`user_id = (select auth.uid())`), i jest to decyzja poprawna oraz udokumentowana.
  Konsekwencja: gdyby `SUPABASE_KEY` był kluczem `service_role` (który omija RLS w całości), `listTeams`
  zwróciłby **wszystkie** drużyny wszystkich kont. Tego nie da się sprawdzić z kodu. Kod jest w porządku;
  ustalenie dotyczy weryfikacji poza repozytorium.
- **Poprawka**: Potwierdzić ręcznie w dashboardzie Supabase, że produkcyjny `SUPABASE_KEY` to klucz
  anon/publishable, i zapisać to jako pozycję kontrolną planu S-07 (audyt izolacji).
- **Decyzja**: ACCEPTED — ryzyko przyjęte świadomie; weryfikacja klucza zakolejkowana jako punkt kontrolny S-07 w `follow-ups/review-fixes.md`

## Uwagi poza ustaleniami

- **`Promise.allSettled` zamiast dwóch `try`/`catch`** (`[id].astro:25-28`) to odchylenie mechanizmu
  wobec litery planu, ale zgodne z jego intencją („oba odczyty, każde z własnym logiem") i lepsze:
  `Promise.all` odrzuciłby całość przy jednej awarii i zgubił drugi log. Nie zgłoszone jako ustalenie.
- **Dyscyplina zakresu jest czysta.** Zweryfikowano każdą pozycję „Czego NIE robimy": zero migracji
  (`supabase/` poza diffem), zero tras `PATCH`/`PUT`/`DELETE`, zero `alert-dialog`, zero atrap
  `<button disabled>`, zero propów bez konsumenta (`grep -rn "teamId" src/` → brak trafień),
  `embark.astro` to dokładnie 6 dodanych linii, `evaluation.missing` nieczytane, `PROTECTED_ROUTES`
  nietknięte, brak paginacji i sortowania w interfejsie.
- **Lekcja z S-03 zastosowana poprawnie.** Obie nowe strony `.astro` są wolne od top-level `return`;
  `[id].astro:11-14` cytuje lekcję wprost, a `npm run lint` (exit 0) to potwierdza.
- **Bezpieczeństwo bez ustaleń CRITICAL i WARNING**: brak `set:html` w `src/`, brak literałów sekretów,
  `astro:env/server` tylko w `src/lib/supabase.ts`, null-check `createClient()` w obu nowych stronach,
  404 nierozróżnialne w ścieżce normalnej i symetryczne w ścieżce degradacji.
