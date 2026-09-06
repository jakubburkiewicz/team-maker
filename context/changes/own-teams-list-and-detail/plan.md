# Plan implementacji: lista własnych drużyn i widok zapisanej drużyny (S-04)

## Przegląd

Domykamy **odczyt** w pętli CRUD nad drużyną. Powstają dwie trasy: `/teams` z listą wyłącznie
własnych zapisanych drużyn (a przy braku jakiejkolwiek — wyjaśnienie i wezwanie do utworzenia
pierwszej, nie zero wyników) oraz `/teams/[id]`, które otwiera zapisany skład, perki i wykres
kompetencji w tej samej wyspie `TeamComposer`, w trybie tylko do odczytu.

Fragment nie tworzy żadnej nowej reguły domenowej i nie dotyka bazy: RLS na `public.teams` już
odcina cudze wiersze, a `evaluateTeam` już potrafi nazwać skład, którego nie da się złożyć
z aktualną pulą. Cała praca to warstwa odczytu i dwa ekrany.

## Analiza stanu obecnego

- **Baza jest gotowa.** `supabase/migrations/20260905185700_teams_schema.sql` zakłada
  `public.teams` z kolumnami `id, user_id, name, composition (jsonb), created_at`, indeksem po
  `user_id` i polityką `select` dla właściciela (`user_id = (select auth.uid())`). Żadna migracja
  w tym fragmencie nie jest potrzebna — polityki `update`/`delete` dokładają S-05 i S-06.
- **Repo czyta za mało.** `src/lib/team-repo.ts:25` ma `SUMMARY_SELECT = "id, name"` i dwie
  funkcje: `createTeam` (zapis) oraz `getTeamSummary` (jeden wiersz pod stronę potwierdzenia).
  Brakuje listy wierszy i odczytu `composition`.
- **Umowa kształtu składu istnieje, ale tylko dla wejścia tekstowego.**
  `src/lib/team-submission.ts:42` (`parseTeamComposition`) przyjmuje `string` i robi `JSON.parse`.
  `composition` z PostgREST wraca **już sparsowane** jako `unknown`, więc ścieżka odczytu nie może
  użyć tej funkcji bez ponownej serializacji.
- **Wyspa jest jednotrybowa.** `src/components/team/TeamComposer.tsx:36` startuje z pustym
  `useState<TeamComposition>([])`, zawsze renderuje przyciski „Recruit"/„Remove"/przełączniki perków
  i zawsze pokazuje `EmbarkGate` z formularzem `POST /api/teams`.
- **Nieznany `characterId` znika po cichu.** `src/components/team/TeamComposer.tsx:69-74` mapuje
  `charactersById.get(...) ?? null`, więc członek spoza puli nie renderuje się w slocie, ale
  `composition.length` liczy go dalej (licznik „Members: N/6"). W S-01 stan nieosiągalny; przy
  składzie z bazy — osiągalny, bo `composition` nie ma klucza obcego do `characters`.
- **Ochrona tras jest już na miejscu.** `src/middleware.ts:4` ma
  `PROTECTED_ROUTES = ["/dashboard", "/teams", "/api/teams"]`; prefiks `/teams` obejmuje z góry
  zarówno `/teams`, jak i `/teams/[id]`. FR-004 nie wymaga tu żadnej zmiany.
- **Wzorzec strony drużyny jest ustalony.** `src/pages/teams/new.astro` pokazuje układ:
  `createClient()` z null-checkiem, repo w `try`/`catch`, log do konsoli, gałąź stanu awarii
  w szablonie. `src/pages/teams/[id]/embark.astro:32-40` pokazuje 404 przez `Astro.response.status`
  plus gałąź renderującą `null`.

## Pożądany stan końcowy

Zalogowany gracz wchodzi na `/teams` i widzi listę wyłącznie swoich drużyn — każda jako nazwa-hash
z datą zapisu, klikalna w całości. Nowe konto widzi wyjaśnienie i przycisk prowadzący do
`/teams/new`. Kliknięcie drużyny otwiera `/teams/[id]` z jej składem rozłożonym na sloty, wybranymi
perkami i wykresem kompetencji — bez możliwości zmiany czegokolwiek. Cudze albo nieistniejące `id`
daje 404, nierozróżnialnie. Drużyna, której zapisany skład nie składa się z aktualną pulą, nie
renderuje się częściowo — strona mówi wprost, że jest niedostępna.

Weryfikacja: `npm run lint`, `npm test` i `npm run build` przechodzą; ręcznie — dwa konta, dwie
drużyny, żadne nie widzi drugiego ani na liście, ani po wklejeniu `id` w adres.

### Kluczowe odkrycia

- `evaluateTeam` **już** zwraca warianty `unknown-character` i `unknown-perk` w `violations`
  (`src/lib/domain/evaluate-team.ts:19-21`). Weryfikacja „czy da się pokazać ten skład" nie wymaga
  nowej reguły — tylko odczytania werdyktu, który reguła i tak wydaje.
- `TeamSummary` z `src/lib/team-repo.ts:14` jest już używany przez `embark.astro` — rozszerzanie go
  o `composition` zaciągnęłoby `jsonb` na stronę, która go nie potrzebuje. Odczyt szczegółów
  dostaje własny typ i własny `select`.
- Lista jest czystym SSR bez `client:*`, więc formatowanie daty w frontmatterze nie ma jak
  rozjechać się z hydratacją.
- `src/lib/domain/test-fixtures.ts` (`TEST_POOL`) daje gotową, małą pulę pod testy nowego modułu —
  bez sięgania po `CHARACTER_POOL` i bez bazy.
- Lekcja z S-03 (`context/foundation/lessons.md`): w `.astro` nie wolno pisać top-level `return` —
  typowana reguła `@typescript-eslint/no-misused-promises` crashuje i wywraca `npm run lint`.

## Czego NIE robimy

- **Żadnej migracji bazy.** Polityki `update`/`delete` oraz `grant` dla nich należą do S-05 i S-06.
- **Żadnej edycji zapisanej drużyny** — brak przycisku zapisu, brak trasy `PATCH`/`PUT`, brak
  interaktywnych slotów na `/teams/[id]` (S-05).
- **Żadnego usuwania** — brak przycisku „Delete", brak `alert-dialog`, brak trasy `DELETE` (S-06).
- **Żadnych wyłączonych atrap przycisków** „Edit"/„Delete" ani propów bez konsumenta (`teamId`
  w wyspie). Decyzja z sesji planowania: czysty odczyt.
- **Żadnej przebudowy `/teams/[id]/embark`** — strona potwierdzenia zostaje tym, czym jest (FR-019);
  dostaje wyłącznie dwa linki nawigacyjne.
- **Żadnego licznika brakujących punktów** (FR-017) — to S-08.
- **Żadnego twardnienia izolacji ponad to, co daje RLS** — audyt wszystkich ścieżek to S-07.
- **Żadnej paginacji, sortowania ani wyszukiwania listy** — PRD nie limituje liczby drużyn, ale
  przy tej skali to reguła i interfejs bez wartości.
- **Żadnej responsywności mobilnej** — Non-Goal PRD.

## Podejście do implementacji

Trzy fazy, każda samodzielnie weryfikowalna: najpierw warstwa odczytu z własnym testem
jednostkowym (zero zmian widocznych dla użytkownika), potem lista, potem widok szczegółów.

Centralną decyzją jest **odmowa zamiast częściowego renderu**. Skład zapisany jako `jsonb` bez
klucza obcego do `characters` może rozjechać się z pulą (zmiana seeda, usunięty perk). Wyspa dziś
mapuje taki wpis na pusty slot, więc ekran pokazałby skład inny niż zapisany — a S-05, zapisując
to, co ekran pokazuje, skasowałby członka bezpowrotnie. Dlatego skład jest sprawdzany **zanim**
trafi do wyspy: dowolne naruszenie z `evaluateTeam` zamienia widok szczegółów w stan „drużyna
niedostępna". Jedno miejsce, jedna reguła, jeden test.

Drugą decyzją jest **jedna wyspa w dwóch trybach** (FR-008: „jeden widok obsługujący oba
przypadki"). `TeamComposer` dostaje skład startowy i flagę trybu; w trybie odczytu sloty nie mają
akcji, a `EmbarkGate` znika — nazwę-hash niesie nagłówek strony. S-05 zdejmie flagę i podłączy
zapis, zamiast budować trzeci ekran.

## Krytyczne szczegóły implementacji

**Czas i cykl życia.** Kolejność faz nie jest dowolna: `/teams/[id]` nie może powstać przed
modułem weryfikującym skład, bo wtedy „na chwilę" istniałby ekran renderujący częściowy skład —
dokładnie stan, którego ten fragment zabrania. Faza 1 musi być zamknięta i przetestowana przed
Fazą 3.

**Sekwencjonowanie stanu w wyspie.** Skład z bazy wchodzi do `useState` jako wartość początkowa,
nie przez `useEffect`. Wyspa pozostaje jedynym właścicielem stanu, a tryb odczytu nie dokłada
własnej gałęzi synchronizacji — inaczej S-05, dodając zapis, odziedziczy dwa źródła prawdy.

## Faza 1: Warstwa odczytu i weryfikacja czytelności składu

### Przegląd

Repo uczy się czytać listę i szczegóły; umowa kształtu składu zostaje wydzielona tak, by ścieżka
zapisu i odczytu dzieliły ją dosłownie; powstaje czysty moduł rozstrzygający, czy zapisany skład
da się pokazać z aktualną pulą — z testem Vitest. Zero zmian widocznych dla użytkownika.

### Wymagane zmiany

#### 1. Wydzielenie kontroli kształtu składu

**Plik**: `src/lib/team-submission.ts`

**Cel**: `composition` z PostgREST wraca już sparsowane, więc ścieżka odczytu potrzebuje tej samej
kontroli kształtu co ścieżka zapisu, ale startującej od `unknown`, nie od `string`. Bez wydzielenia
powstałaby druga, rozjeżdżająca się kopia umowy `{ characterId, perkIds }`.

**Umowa**: nowy eksport `toTeamComposition(value: unknown): TeamComposition | null` — dotychczasowa
treść `parseTeamComposition` od miejsca „czy to tablica" w dół; `parseTeamComposition` zostaje
`JSON.parse` w `try`/`catch` plus delegacja do niej. Zachowanie i sygnatura
`parseTeamComposition` bez zmian (jej testy w `src/lib/team-submission.test.ts` muszą przejść
nietknięte). Docstring modułu dostaje zdanie, że moduł jest odtąd wspólną umową kształtu składu
dla obu kierunków, nie tylko dla zapisu.

#### 2. Odczyt listy i szczegółów drużyny

**Plik**: `src/lib/team-repo.ts`

**Cel**: dołożyć dwie funkcje odczytu — listę własnych drużyn pod `/teams` i pojedynczy wiersz ze
składem pod `/teams/[id]`. Istniejące `createTeam` i `getTeamSummary` zostają nietknięte, bo
`embark.astro` nie potrzebuje `jsonb`.

**Umowa**:

- `TeamListItem { id: string; name: string; createdAt: string }` oraz
  `listTeams(supabase): Promise<readonly TeamListItem[]>` — `select("id, name, created_at")`
  posortowane malejąco po `created_at` (najnowsza drużyna na górze). **Pusta lista jest legalnym
  stanem** i wraca jako `[]` — inaczej niż w `getCharacterPool`, gdzie zero wierszy oznacza awarię.
  Rzuca wyłącznie przy błędzie zapytania, wzorem pozostałych funkcji repo.
- `TeamDetail { id: string; name: string; composition: TeamComposition }` oraz
  `getTeamDetail(supabase, id: string | undefined): Promise<TeamDetail | null>` —
  `select("id, name, composition")`, `maybeSingle()`, ta sama strażnica `isTeamId` co
  w `getTeamSummary`, `null` nierozróżnialnie dla nieznanego id, cudzego wiersza (RLS) i nie-UUID.
- `composition` z bazy przechodzi przez `toTeamComposition`; wynik `null` (wiersz nie ma kształtu
  `[{ characterId, perkIds }]`) **rzuca**, nie zwraca `null` — to stan niemożliwy przy jedynym
  pisarzu `POST /api/teams`, więc należy do tej samej kategorii co pusta pula w
  `character-pool-repo.ts:103`, a nie do „drużyny nie ma".
- Moduł nadal nie importuje `@/lib/supabase` ani niczego z `astro:*`.

#### 3. Rozstrzygnięcie, czy zapisany skład da się pokazać

**Plik**: `src/lib/team-view.ts` (nowy)

**Cel**: jedno miejsce, w którym zapada decyzja „ten skład da się pokazać z aktualną pulą" — żeby
strona nie renderowała częściowego składu, a S-05 nie zapisał okrojonego. Moduł leży w `src/lib/`
(granica odczytu), nie w `src/lib/domain/` — nie dokłada reguły, tylko czyta werdykt `evaluateTeam`.

**Umowa**: `resolveSavedTeam(composition: TeamComposition, pool: CharacterPool)` zwracające
`{ ok: true; composition } | { ok: false; violations }` — kształt symetryczny do
`gateTeamSubmission` w `team-submission.ts:73`. Odrzuca, gdy `evaluateTeam(...).violations` jest
niepuste (dowolne naruszenie, nie tylko `unknown-*`: skład z siedmioma członkami też nie zmieści
się w sześciu slotach). **Próg nie jest tu sprawdzany ponownie** — o `isValid` decyduje bramka
zapisu; blokowanie odczytu drużyny poniżej progu ukrywałoby dane zamiast je pokazać. Moduł jest
czysty: bez `astro:*`, bez `@/lib/supabase`.

#### 4. Test nowego modułu

**Plik**: `src/lib/team-view.test.ts` (nowy)

**Cel**: dowód, że odmowa działa dokładnie tam, gdzie ma — bo to jedyna bariera między
rozjechanym rekordem a ekranem pokazującym skład inny niż zapisany.

**Umowa**: przypadki na `TEST_POOL` z `src/lib/domain/test-fixtures.ts` — skład złożony w całości
z puli przechodzi; skład z `characterId` spoza puli odrzucony; skład z `perkId` spoza puli
odrzucony; pusty skład przechodzi (zero członków to legalny kształt, nawet jeśli nie da się go
zapisać). Identyfikatory brane z puli, nie wpisywane literałami (uwaga F3 z przeglądu S-01).

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Testy przechodzą, w tym nowy plik `team-view.test.ts`: `npm test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Testy `src/lib/team-submission.test.ts` przechodzą bez żadnej edycji (dowód, że wydzielenie
  `toTeamComposition` nie zmieniło zachowania `parseTeamComposition`)

#### Ręczna weryfikacja

- `src/lib/team-view.ts` nie importuje `astro:*` ani `@/lib/supabase` (kontrola wzrokowa importów)

---

## Faza 2: Lista własnych drużyn pod `/teams`

### Przegląd

Nowa strona indeksowa z listą, stanem pustym i stanem awarii odczytu; dashboard prowadzi do niej
linkiem.

### Wymagane zmiany

#### 1. Strona listy

**Plik**: `src/pages/teams/index.astro` (nowa)

**Cel**: pokazać wyłącznie własne drużyny (FR-005) i poprowadzić nowe konto do utworzenia pierwszej
(US-01, kryterium stanu pustego). Trasa mieści się w prefiksie `/teams` z `PROTECTED_ROUTES`, więc
niezalogowany trafia na logowanie bez żadnej zmiany w middleware (FR-004).

**Umowa**: układ frontmattera wzorem `src/pages/teams/new.astro` — `createClient()` z null-checkiem
jako obroną w głąb, `listTeams` w `try`/`catch`, `console.error` z `eslint-disable-next-line
no-console`, stan awarii jako osobna gałąź szablonu. Trzy stany w szablonie:

- **awaria odczytu** — komunikat ogólny plus powrót do dashboardu, wizualnie jak gałąź błędu
  w `new.astro:53-62`;
- **pusta lista** — wyjaśnienie, czym jest drużyna, i wezwanie „Assemble your first team"
  prowadzące do `/teams/new`; **nie** „0 results";
- **lista** — pozycje jako nazwa-hash (`font-mono`, jak w `embark.astro:47`) plus data zapisu
  z `createdAt`, każda pozycja w całości linkiem do `/teams/<id>`; nad listą link „Assemble a new
  team".

Data formatowana deterministycznie w frontmatterze (jedna stała lokalizacja i format, bez zależności
od strefy przeglądarki). Strona jest czystym SSR — żadnego `client:*`.

#### 2. Wejście z dashboardu

**Plik**: `src/pages/dashboard.astro`

**Cel**: lista musi być osiągalna ze ścieżki, którą gracz widzi zaraz po zalogowaniu — inaczej
istnieje, ale nikt na nią nie trafia.

**Umowa**: dodać link „Your teams" → `/teams` obok istniejącego „Assemble a new team"
(`dashboard.astro:17-22`), tym samym stylem. Nic więcej na tej stronie się nie zmienia.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Linting przechodzi: `npm run lint`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja

- Świeże konto na `/teams` widzi wyjaśnienie i wezwanie do utworzenia pierwszej drużyny, nie pustą
  tabelę ani „0 results"
- Po zapisaniu drużyny `/teams` pokazuje ją z nazwą-hashem i datą; pozycja jest linkiem do
  `/teams/<id>` (przejście kliknięciem weryfikuje Faza 3 — trasa powstaje dopiero tam)
- Drugie konto na `/teams` nie widzi drużyny pierwszego konta
- Wylogowany na `/teams` ląduje na `/auth/signin`
- Dashboard ma widoczne wejście na listę

---

## Faza 3: Widok zapisanej drużyny pod `/teams/[id]`

### Przegląd

`TeamComposer` uczy się trybu tylko do odczytu i startu ze składem z bazy; nowa strona składa to
z odczytem i weryfikacją z Fazy 1; strona potwierdzenia dostaje linki domykające pętlę
zapis → lista → szczegóły.

### Wymagane zmiany

#### 1. Tryb tylko do odczytu w wyspie

**Pliki**: `src/components/team/TeamComposer.tsx`, `src/components/team/RosterSlot.tsx`

**Cel**: pokazać zapisany skład, perki i wykres w tym samym komponencie co kompletowanie (FR-008),
bez możliwości zmiany czegokolwiek — i tak, żeby S-05 zdejmował flagę, a nie przepisywał ekran.

**Umowa**:

- `TeamComposer` przyjmuje dodatkowo `initialComposition?: TeamComposition` (wartość początkowa
  `useState`, **nie** przez `useEffect`) oraz `readOnly?: boolean`, oba domyślnie zachowujące
  dzisiejsze zachowanie `/teams/new` (pusty skład, pełna interaktywność).
- Przy `readOnly` w slocie **nie istnieje żaden element akcji** — nie `<button disabled>`, tylko
  brak przycisku (krok 4 testów ręcznych, kryterium 3.5). Konkretnie:
  - **Perki** renderują się jako `<li>`/`<span>`, nie `<button>`. Wybrane zachowują dzisiejsze
    wyróżnienie (`border-purple-400/60 bg-purple-500/20`), niewybrane pozostają w pełni widoczne
    w neutralnym wariancie — **bez** `disabled:opacity-40` z `RosterSlot.tsx:74`. To istotne, nie
    kosmetyczne: przy zapisanych dwóch perkach dzisiejsza gałąź `disabled={!selected &&
    limitReached}` wyszarzyłaby trzeci perk na „niedostępny", podczas gdy FR-014 wymaga odczytu
    „niewybrany" — trzeci perk jest częścią zapisanego wyboru „2 z 3", a nie brakiem możliwości.
  - **Puste sloty** renderują nieinteraktywny placeholder (ta sama przerywana ramka, bez `onClick`,
    bez hovera i bez etykiety „Recruit") — sześć slotów zostaje, żeby wykres i skład czytały się
    tak samo jak przy kompletowaniu.
  - **Zajęte sloty** nie renderują „Remove".
  - **Licznik `Members: N/6`** zostaje bez zmian — jest odczytem, nie akcją.
  `MemberPickerDialog` nie jest montowany.
- Przy `readOnly` `EmbarkGate` nie jest renderowany — formularz `POST /api/teams` nie może istnieć
  na ekranie istniejącej drużyny. **W jego miejsce nie wchodzi nic**: nazwę-hash niesie nagłówek
  strony (`.astro`, pkt 2), więc wyspa nie dostaje propu `teamName` — powielałby tę samą wartość
  na jednym ekranie, a S-05 i tak wstawi w to miejsce przycisk zapisu.
- `RosterSlot` dostaje wariant nieinteraktywny — sygnatura zmienia się tak, by tryb odczytu nie
  musiał przekazywać pustych funkcji-atrap. Kontrakt komponentu zostaje bezstanowy i sterowany
  propsami, jak dziś.
- Komentarz z `TeamComposer.tsx:68` („co z nim robić rozstrzyga S-04") zostaje zastąpiony
  odesłaniem do `resolveSavedTeam` jako miejsca, które ten przypadek odcina zanim skład tu dotrze.

#### 2. Strona szczegółów

**Plik**: `src/pages/teams/[id].astro` (nowa)

**Cel**: otworzyć zapisaną drużynę ze składem, perkami i wykresem (FR-008), nie ujawniając niczego
o cudzych rekordach.

**Umowa**: frontmatter czyta równolegle `getTeamDetail` i `getCharacterPool`, każde w `try`/`catch`
z logiem; następnie `resolveSavedTeam`. Cztery wyniki:

- `getTeamDetail` zwraca `null` → **404**, zapisane jako `Astro.response.status = 404` plus gałąź
  szablonu renderująca `null` — nigdy jako top-level `return` (lekcja z S-03, wywraca `npm run lint`);
- błąd odczytu drużyny albo puli → stan „niedostępna teraz" z powrotem do listy;
- `resolveSavedTeam` odrzuca → stan „drużyna nie da się złożyć z aktualną pulą" z powrotem do listy;
  komunikat mówi, że skład jest niespójny, i nie renderuje żadnej części składu. Ta gałąź
  **musi logować** (`console.error` z `id` drużyny i listą `violations`, wzorem `new.astro:26-28`):
  awaria zapytania jest przemijająca i zgłosi się sama, a odrzucony skład oznacza rekord w bazie
  nie do złożenia z pulą — jedyny stan w tym fragmencie, którego bez logu nie da się zdiagnozować
  w Workerze;
- sukces → `TeamComposer` z `pool`, `initialComposition` i `readOnly`, **bez żadnej dyrektywy
  `client:*`**.

Brak hydratacji jest tu decyzją, nie przeoczeniem: w trybie odczytu wyspa nie ma ani jednej
interakcji (`MemberPickerDialog` niemontowany, `EmbarkGate` nierenderowany, sloty bez akcji),
`useState` służy wyłącznie za wartość początkową, a `CompetencyRadar` to statyczny SVG — więc
render serwerowy daje ten sam ekran przy zerowym JS. Dzięki temu kryterium 3.5 („nie da się nic
zmienić") wynika z braku runtime'u, a nie z poprawnie przekazanej flagi. **Nota dla S-05**:
podłączając zapis, trzeba dopisać `client:load` z powrotem.

Nagłówek strony niesie nazwę-hash i link „← Your teams". Trasa jest już chroniona prefiksem
`/teams`; nie dotykamy `PROTECTED_ROUTES`.

#### 3. Domknięcie nawigacji na stronie potwierdzenia

**Plik**: `src/pages/teams/[id]/embark.astro`

**Cel**: po zapisie gracz ma dziś tylko „Assemble another team" i dashboard — lista i szczegóły,
choć istnieją, są nieosiągalne ze ścieżki, która naturalnie do nich prowadzi.

**Umowa**: w bloku linków (`embark.astro:58-65`) dodać „View this team" → `/teams/<id>` oraz
„Your teams" → `/teams`. Treść potwierdzenia i komunikat „Work in Progress" (FR-019) zostają
nietknięte.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Linting przechodzi, w tym reguły typowane na obu nowych stronach `.astro`: `npm run lint`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja

- `/teams/<własne-id>` pokazuje dokładnie zapisany skład: te same postacie i te same perki co przy
  zapisie, wykres zgodny ze składem
- Na `/teams/<id>` nie da się dodać, usunąć ani przełączyć niczego; nie ma przycisku „Embark",
  a widoczna jest nazwa-hash drużyny — strona renderuje się bez wyspy (brak `client:*`)
- `/teams/<cudze-id>` i `/teams/<losowy-uuid>` dają 404 nierozróżnialnie; `/teams/abc` (nie-UUID)
  też
- `/teams/new` nadal działa jak dotąd: pusty skład, pełna interaktywność, bramka „Embark" odblokowuje
  się przy domkniętym progu i zapisuje drużynę
- Po zapisie strona potwierdzenia prowadzi do widoku tej drużyny i do listy

---

## Strategia testowania

### Testy jednostkowe

- `src/lib/team-view.test.ts` — odmowa dla `characterId` spoza puli, odmowa dla `perkId` spoza puli,
  przejście dla składu w całości z puli, przejście dla pustego składu.
- `src/lib/team-submission.test.ts` — bez edycji; jego przejście jest testem regresji dla
  wydzielenia `toTeamComposition`.

Bez zmian w umowie testów z AGENTS.md: nic pod testem nie importuje `astro:*` ani `@/lib/supabase`,
więc `listTeams` i `getTeamDetail` (Supabase) pozostają w weryfikacji ręcznej, jak dzisiejsze
`createTeam` i `getTeamSummary`.

### Testy integracyjne

Brak — repo nie ma warstwy integracyjnej, a jej wprowadzenie należy do Modułu 3.

### Kroki testowania ręcznego

1. `npm run dev`, konto A: `/teams` na świeżym koncie → wyjaśnienie i wezwanie do utworzenia
   pierwszej drużyny.
2. Skompletować i zapisać drużynę; ze strony potwierdzenia przejść „View this team".
3. Porównać skład i perki na `/teams/<id>` z tym, co było na `/teams/new` przed zapisem; sprawdzić,
   że wykres pokazuje te same punkty.
4. Spróbować kliknąć slot, perk i przycisk usuwania na `/teams/<id>` — nic się nie dzieje, elementy
   akcji nie istnieją.
5. Wrócić na `/teams` — drużyna na liście z nazwą-hashem i datą.
6. Wylogować się, zalogować na konto B: `/teams` puste; wkleić `id` drużyny konta A w adres → 404.
7. Wkleić `/teams/00000000-0000-4000-8000-000000000000` i `/teams/abc` → 404 w obu przypadkach.
8. Wrócić na `/teams/new` i zapisać drugą drużynę — sprawdzić, że ścieżka kompletowania nie
   ucierpiała po dodaniu trybu odczytu.

## Uwagi dotyczące wydajności

Lista ciągnie trzy kolumny bez `composition`, po indeksie `teams_user_id_idx`. Widok szczegółów
robi dwa zapytania (drużyna + pula) — pula jest tym samym odczytem co na `/teams/new`.
`evaluateTeam` liczy siedem sum nad ≤ 6 członkami, w trybie odczytu raz na render. NFR 200 ms
z zapasem; nic tu nie wymaga optymalizacji.

## Uwagi dotyczące migracji

Brak migracji bazy. Fragment nie zmienia schematu, polityk ani przywilejów, więc nie ma
`supabase db push` na końcu — inaczej niż w S-03. Nie ma też danych do przemigrowania: drużyny
zapisane przez S-03 są czytane w tym samym kształcie, w jakim je zapisano.

## Referencje

- Element mapy drogowej: `context/foundation/roadmap.md` → S-04
- Wymaganie wstępne (zarchiwizowane): `context/archive/2026-09-05-first-saved-team/plan.md`
- Lekcje wiążące ten plan: `context/foundation/lessons.md` (top-level `return` w `.astro`)
- Wzorzec strony drużyny: `src/pages/teams/new.astro`
- Wzorzec 404 w `.astro`: `src/pages/teams/[id]/embark.astro:32-40`
- Wzorzec repo: `src/lib/character-pool-repo.ts:88-107`, `src/lib/team-repo.ts:42-80`
- Wzorzec bramki czystej: `src/lib/team-submission.ts:73-85`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków.

### Faza 1: Warstwa odczytu i weryfikacja czytelności składu

#### Automatyczne

- [x] 1.1 Testy przechodzą, w tym nowy plik `team-view.test.ts`: `npm test` — 5471447
- [x] 1.2 Linting przechodzi: `npm run lint` — 5471447
- [x] 1.3 Build przechodzi: `npm run build` — 5471447
- [x] 1.4 Testy `src/lib/team-submission.test.ts` przechodzą bez żadnej edycji — 5471447

#### Ręczne

- [x] 1.5 `src/lib/team-view.ts` nie importuje `astro:*` ani `@/lib/supabase` — 5471447

### Faza 2: Lista własnych drużyn pod `/teams`

#### Automatyczne

- [x] 2.1 Linting przechodzi: `npm run lint` — 2bfb8d0
- [x] 2.2 Testy przechodzą: `npm test` — 2bfb8d0
- [x] 2.3 Build przechodzi: `npm run build` — 2bfb8d0

#### Ręczne

- [x] 2.4 Świeże konto na `/teams` widzi wyjaśnienie i wezwanie, nie „0 results" — 2bfb8d0
- [x] 2.5 Zapisana drużyna widoczna z nazwą-hashem i datą; pozycja jest linkiem do `/teams/<id>` — 2bfb8d0
- [x] 2.6 Drugie konto nie widzi drużyny pierwszego konta — 2bfb8d0
- [x] 2.7 Wylogowany na `/teams` ląduje na `/auth/signin` — 2bfb8d0
- [x] 2.8 Dashboard ma widoczne wejście na listę — 2bfb8d0

### Faza 3: Widok zapisanej drużyny pod `/teams/[id]`

#### Automatyczne

- [x] 3.1 Linting przechodzi, w tym reguły typowane na nowych stronach `.astro`: `npm run lint`
- [x] 3.2 Testy przechodzą: `npm test`
- [x] 3.3 Build przechodzi: `npm run build`

#### Ręczne

- [x] 3.4 `/teams/<własne-id>` pokazuje dokładnie zapisany skład i zgodny wykres
- [x] 3.5 Na `/teams/<id>` nie da się nic zmienić; brak „Embark", widoczna nazwa-hash, brak `client:*`
- [x] 3.6 Cudze id, losowy UUID i nie-UUID dają 404 nierozróżnialnie
- [x] 3.7 `/teams/new` nadal kompletuje i zapisuje drużynę bez regresji
- [x] 3.8 Strona potwierdzenia prowadzi do widoku drużyny i do listy
