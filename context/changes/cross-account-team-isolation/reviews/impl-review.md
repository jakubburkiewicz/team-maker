<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Cudza drużyna jest niedostępna każdą ścieżką

- **Plan**: context/changes/cross-account-team-isolation/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny plan, 28/28 kroków `[x]`)
- **Data**: 2026-09-06
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

### Weryfikacja automatyczna (uruchomiona dosłownie)

| Kryterium | Wynik |
|---|---|
| `npm test` | PASS — 139 testów, 12 plików |
| `npx astro sync && npm run lint` | PASS — exit 0 |
| `npm run build` | PASS — exit 0 |
| 1.4 dwa importy `TeamNotFound.astro` | PASS (2) |
| 1.5 dwa pliki z `Astro.response.status = 404` | PASS (2) |
| 1.6 jedno źródło komunikatu w `src/` | PASS (1) |
| 1.7 zero top-level `return` w trzech `.astro` | PASS |
| 1.8 obie trasy zapisu z `encodeURIComponent` | PASS (2) |
| 1.9 / 2.4 / 2.8 `supabase/` nietknięte | PASS |
| 2.2 jedenaście `it(` | PASS (11) |
| 2.5 test bez `astro:*` i `@/lib/supabase` | PASS |

### Kontrole mutacyjne odtworzone niezależnie

Odtworzone w izolowanej kopii (`scratchpad/mut`, symlink na `node_modules`), repozytorium nietknięte —
`git status --porcelain` pusty przed i po.

| Mutacja | Oczekiwanie | Wynik |
|---|---|---|
| usunięcie `enable row level security` | czerwony | ✅ czerwony (2.6 potwierdzone) |
| usunięcie polityki `owner can read teams` | czerwony | ✅ czerwony (2.7 potwierdzone) |
| `using (true)` w polityce `select` | czerwony | ✅ czerwony |
| `alter table only public.teams disable row level security` | czerwony | ✅ czerwony |
| `ALTER TABLE PUBLIC.TEAMS DISABLE …` (wielkie litery) | czerwony | ✅ czerwony |
| `drop policy … on public.teams` | czerwony | ✅ czerwony |
| `alter policy … on public.teams using (true)` | czerwony | ❌ **zielony** (F1) |
| `alter table teams disable row level security` (bez schematu) | czerwony | ❌ **zielony** (F2) |
| `drop policy … on teams` (bez schematu) | czerwony | ❌ **zielony** (F2) |
| `grant update, delete on public.teams` | czerwony | ❌ **zielony** (F2, strażnik istniejący) |
| `grant all on all tables in schema public` | czerwony | ❌ **zielony** (F2, strażnik istniejący) |
| `alter policy` z `auth.uid()` (furtka) | zielony | ✅ zielony |

## Ustalenia

### F1 — `alter policy … using (true)` rozbraja odczyt i przechodzi cały pakiet testów

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/teams-policy-sql.test.ts:180-192 (i komentarz 94-95)
- **Szczegóły**: Komentarz przy nowej asercji `select` (linie 94-95) nazywa najgroźniejszą mutację
  wprost: „groźna jest odwrotna mutacja: rozluźnienie `using` do `true`, po którym każdy widzi
  wszystko, a testy zachowania dalej są zielone". Tej mutacji nie pilnuje nic. Strażnik `drop policy`
  **celowo** przepuszcza `alter policy` (furtka z umowy planu, linie 181-188); asercja pozytywna czyta
  `_teams_schema.sql`, którego nowa migracja nie rusza; `src/lib/team-schema.test.ts:66-74` iteruje
  wyłącznie po poleceniach zaczynających się od `create policy`. Zweryfikowane empirycznie: dopisanie
  migracji z `alter policy "owner can read teams" on public.teams using (true);` daje **17/17 zielonych**
  w obu plikach kotwic SQL. Faza 2 istnieje po to, żeby domknąć klasę „przyszła migracja rozbraja
  izolację po cichu" — a najcichsza droga została otwarta przez furtkę, którą sam plan zamówił.
  To jest usterka **planu**, nie odstępstwo implementacji: umowa Fazy 2 wymieniała dokładnie dwóch
  strażników i implementacja dała dokładnie tych dwóch.
- **Poprawka A ⭐ Zalecane**: Dołożyć w `teams-policy-sql.test.ts` trzeciego strażnika: każde
  `alter policy … on … teams` musi zawierać `auth.uid()` (furtka `alter policy` zostaje otwarta dla
  korekt, ale nie dla rozbrojenia).
  - Siła: Zamyka dokładnie tę drogę, którą furtka otworzyła, w tym samym pliku, który ogłasza się
    kompletną macierzą barier; nie koliduje z §Uwagi dotyczące migracji („korekta idzie przez `alter policy`").
  - Kompromis: Szósty regex w pliku, w którym regexy już się rozjeżdżają (patrz F2) — bez wspólnego
    fragmentu tabeli dług rośnie.
  - Pewność: WYSOKA — luka i skuteczność łatki potwierdzone empirycznie na kopii repozytorium.
  - Martwy punkt: Nie sprawdzono, czy `create policy … using (true)` na `teams` jest łapane w tym
    pliku — łapie je `team-schema.test.ts:73`, więc plik nie jest samowystarczalny mimo deklaracji z linii 68-69.
- **Poprawka B**: Rozszerzyć iterację `src/lib/team-schema.test.ts:66-74` z `create policy` na
  `alter policy`, gdzie kontrola „każda polityka wiąże wiersz z `auth.uid()`" już istnieje.
  - Siła: Jedna kontrola zamiast dwóch; odporna na warianty składni, bo działa na podzielonych
    poleceniach, nie na regexie.
  - Kompromis: `alter policy` ma opcjonalne `TO role`, więc istniejąca asercja `policyRoles(policy) === "authenticated"`
    zwróciłaby `null` i test padłby na poprawnej migracji — wymaga przerobienia pętli, czyli dotknięcia
    pliku spoza zakresu tej zmiany.
  - Pewność: ŚREDNIA — kierunek dobry, ale koszt większy niż wygląda.
  - Martwy punkt: Nie zmierzono, ile innych asercji w tej pętli założyło `create policy`.

- **Decyzja**: NAPRAWIONE poprawką A — strażnik `alter policy` dołożony (`teams-policy-sql.test.ts`, 12. przypadek); kryterium 2.2 w `plan.md` skorygowane z 11 na 12; kontrola mutacyjna potwierdzona (czerwony na `using (true)`, zielony na korekcie z `auth.uid()`)

### F2 — Strażnicy SQL wiążą się wyłącznie na `public.teams`; wariant bez schematu przechodzi

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/teams-policy-sql.test.ts:175, 189 (nowe) oraz 124, 160-162 (istniejące)
- **Szczegóły**: Wszystkie sześć wzorców wymaga literalnego `public.teams`. Zweryfikowane empirycznie
  na kopii: `alter table teams disable row level security;`, `drop policy … on teams;`,
  `grant all on teams …` przechodzą na zielono, mimo że w Supabase `search_path` migracji obejmuje
  `public`, więc są w pełni skuteczne. Do tego dwie dziury w strażnikach **istniejących**:
  `grant update, delete on public.teams` przechodzi (wzorzec `grant\s+update\s+on` nie znosi listy
  przywilejów — a `20260905185700_teams_schema.sql:46` sam pisze `revoke update, delete, truncate on
  public.teams`, więc autor przyszłej migracji odbije właśnie ten kształt), i `grant all on all tables
  in schema public` przechodzi. To ta sama klasa co zapisana lekcja „Kryteria grepowe kotwicz na
  składni, nie na słowach", o krok dalej: kotwica na składni musi pokrywać **legalne warianty tej składni**.
- **Poprawka**: Wprowadzić w pliku jeden wspólny fragment tabeli, np.
  `const TEAMS = String.raw`(?:"?public"?\s*\.\s*)?"?teams"?\b`;` i użyć go we wszystkich sześciu
  wzorcach; przy okazji zamienić `grant\s+update\s+on` na wariant znoszący listę przywilejów
  z lookaheadem chroniącym `grant update (composition)`.

- **Decyzja**: NAPRAWIONE — wspólny fragment `TEAMS_TABLE` w sześciu strażnikach, wzorzec `grant update` znosi listę przywilejów (lookahead chroni `grant update (composition)`), dołożone dwa warianty tej samej klasy wykryte sondą: `grant all on all tables in schema public` i rola `public`. Zweryfikowane: 9 wariantów rozbrajających czerwienieje, 4 legalne przechodzą; `npm test` 140 zielonych, lint zielony, kryterium 2.2 dalej = 12

### F3 — Faza 3: umowa wymagała kodów HTTP przy odhaczeniu; §Progress niesie tylko SHA

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔬 WYSOKI — stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/changes/cross-account-team-isolation/plan.md:545-553
- **Szczegóły**: Umowa kroku 2 Fazy 3: „Każdy krok macierzy odnotowuje przy odhaczeniu **kod
  odpowiedzi HTTP**, a kroki 3.7 i 3.8 dodatkowo **komunikat z nagłówka `Location`**". Odhaczenia
  3.3–3.11 niosą wyłącznie preegzystujący tytuł kroku plus ` — b2c5d37`; diff commitu p3 zmienia
  w tych wierszach wyłącznie `[ ]` → `[x]`. Wzmianki o `404`, `302` i `Could not save the team`
  w tytułach 3.5–3.8 pochodzą z planu napisanego **przed** przebiegiem, nie z zapisu obserwacji.
  Skutek: dwa zabezpieczenia przed fałszywie zielonym wynikiem, które plan sam nazwał
  (403 z `checkOrigin` = żądanie nie dotarło do RLS; komunikat inny niż `SAVE_FAILED_MESSAGE` =
  zatrzymała je bramka progu przed RLS) nie mają w repozytorium weryfikowalnego śladu. Faza 3 jest
  **jedynym** dowodem własności binarnej z PRD — `npm test` dowodzi treści migracji, nie zachowania bazy.
  Rozjazd jest jawnie przyznany przez implementującego w `change.md` („kody odpowiedzi HTTP nie
  zostały przechwycone w transkrypcie sesji, wbrew Umowie kroku 2 Fazy 3"), więc jest audytowalny,
  nie zamaskowany. Kroki 3.1–3.2 udokumentowano rzetelnie (Version ID `a6fc4019-…`, smoke-test 302).
- **Poprawka A ⭐ Zalecane**: Przyjąć jako świadome ryzyko i dopisać w §Progress przy 3.3–3.11
  odsyłacz do adnotacji w `change.md`, żeby audytor trafił na ślad bez czytania obu plików.
  - Siła: Rejestr mówi prawdę o swojej sile dowodowej; koszt zerowy; adnotacja w `change.md` już
    istnieje i jest niezwykle uczciwa co do tego, co wykonał operator, a czego agent.
  - Kompromis: Dowód pozostaje słowem operatora; ktoś, kto przyjdzie za pół roku, nie odróżni
    „przebieg zielony" od „przebieg zatrzymany przez CSRF i wzięty za zielony".
  - Pewność: ŚREDNIA — zależy od tego, ile ważą dwie pułapki, które plan zidentyfikował właśnie dlatego,
    że są nie do odróżnienia od sukcesu.
  - Martwy punkt: Nie da się dziś ustalić, czy krok 3.7 rzeczywiście zobaczył `Could not save the team`,
    czy komunikat bramki progu.
- **Poprawka B**: Powtórzyć kroki 3.5–3.8 na produkcji z przechwyceniem kodu i nagłówka `Location`
  w zakładce Network i wpisać zaobserwowane wartości do §Progress.
  - Siła: Domyka jedyny dowód Guardrailu w formie, którą plan sam uznał za wiążącą.
  - Kompromis: Wymaga dwóch potwierdzonych skrzynek i dwóch sesji przeglądarkowych; to praca
    operatora, nie agenta, i powtarza przebieg już raz wykonany.
  - Pewność: WYSOKA — procedura jest w planie opisana krok po kroku, łącznie z ładunkiem dla 3.7.
  - Martwy punkt: Konta A i B z pierwszego przebiegu mogą już nie istnieć lub mieć zmieniony stan.

- **Decyzja**: ZAAKCEPTOWANE JAKO RYZYKO (poprawka A) — w `plan.md` §Progress Faza 3 / Ręczne dopisana nota o sile dowodowej kroków 3.3-3.11 z odsyłaczem do `change.md` §Notes; dowód pozostaje potwierdzeniem operatora, brak śladu kodów HTTP nazwany wprost w rejestrze

### F4 — Surowe `Astro.params.id` w logach obu stron, wbrew poprawce F2 z tego samego commitu

- **Ważność**: 👀 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/teams/[id].astro:48, src/pages/teams/[id]/embark.astro:31
- **Szczegóły**: `console.error(\`Failed to load team for /teams/${Astro.params.id ?? ""}\`, …)` loguje
  surową wartość. `GET /teams/%0A%0AERROR%20fake` wstrzykuje sfabrykowane linie do logów Workera.
  Faza 1 usunęła dokładnie tę niespójność w trasach API (`[id].ts:76,94,101` logują wersję zakodowaną)
  — i zostawiła ją na stronach, w tym samym commicie.
- **Poprawka**: Dodać `const id = encodeURIComponent(Astro.params.id ?? "");` we frontmatterze obu
  stron i logować tę wartość.

- **Decyzja**: NAPRAWIONE — `const loggedId = encodeURIComponent(Astro.params.id ?? "")` we frontmatterze obu stron; do repo dalej idzie wartość surowa. Lint i 140 testów zielone, kryteria 1.5 i 1.7 bez regresji

### F5 — Brak konfiguracji Supabase prezentuje się jako „nie ma takiej drużyny"

- **Ważność**: 👀 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/teams/[id].astro:32,62, src/pages/teams/[id]/embark.astro:18,36
- **Szczegóły**: Gdy `createClient()` zwróci `null`, blok `if (supabase)` się nie wykonuje,
  `teamFailed`/`failed` zostaje `false`, więc `notFound === true` i **każde** id — także własne —
  dostaje 404 „This team does not exist, or it is not yours.". Awaria konfiguracji mówi graczowi
  nieprawdę o jego własnych danych. Przed Fazą 1 kosztem była biała strona; teraz jest nią zdanie,
  które twierdzi coś fałszywego. Praktycznie nieosiągalne (middleware przekierowuje wcześniej), ale
  to jest gałąź obrony w głąb — jej sensem jest zachowanie się poprawnie, gdy pierwsza bariera padnie.
- **Poprawka**: `let failed = supabase === null;` (analogicznie `teamFailed`), żeby brak klienta
  trafiał w gałąź „Team is unavailable right now".

- **Decyzja**: NAPRAWIONE — `let teamFailed = supabase === null;` i `let failed = supabase === null;` na obu stronach, więc brak klienta trafia w gałąź „Team is unavailable right now", nie w ekran izolacji. Lint, 140 testów i build zielone; kryteria 1.4-1.9 i 2.2 bez regresji

### F6 — Nieaktualny docstring w `delete.ts` — jedyny w `src/` wskaźnik na rozstrzygniętą już decyzję

- **Ważność**: 👀 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/pages/api/teams/[id]/delete.ts:33-36
- **Szczegóły**: Docstring `DELETE_FAILED_MESSAGE` dalej głosi „`null` z repo kończy się gołym 404
  bez komunikatu" oraz „rozstrzygnięcie »404 vs przekierowanie« należy do S-07". Obie tezy są po
  Fazie 1 nieprawdziwe. `grep -rn 'S-07' src/` pokazuje, że to jedyne pozostałe miejsce w kodzie
  zapowiadające decyzję, która zapadła. Plan celowo nie obejmował edycji tego pliku, więc to nie jest
  odstępstwo od umowy — ale repozytorium traktuje komentarze jako pierwszorzędną dokumentację decyzji.
- **Poprawka**: Zaktualizować te dwa zdania: 404 nie jest już gołe (`TeamNotFound.astro`), a S-07
  rozstrzygnął na „404 z pełną stroną".

- **Decyzja**: NAPRAWIONE — docstring `DELETE_FAILED_MESSAGE` opisuje stan po S-07 (ekran 404 z `TeamNotFound.astro`, rozstrzygnięcie zapadło na 404 z pełną stroną). W `src/` nie ma już komentarza zapowiadającego nierozstrzygniętą decyzję S-07

### F7 — `roadmap.md` poza „Wymagane zmiany"; §S-07 dalej zapowiada nierozstrzygnięty wybór

- **Ważność**: 👀 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: context/foundation/roadmap.md:68, 317-320
- **Szczegóły**: Plan nie wymienia `roadmap.md` w „Wymagane zmiany". Netto zmiana to `proposed` →
  `in-progress` w dwóch krokach — rutynowa księgowość cyklu życia slice'u, taka sama jak przy S-04–S-06,
  więc nieszkodliwa (na `done` przestawia `/10x-archive`, wzorzec z commitu 4f2eb24). Zostaje jednak
  §S-07 „Punkt kontrolny z S-03" (l. 317-319): „S-07 rozstrzyga docelowo (404 vs redirect na listę)
  i dokłada nawigację" — pytanie, na które ta zmiana odpowiedziała, a odpowiedź zapisano w komentarzach
  `.astro` i w `change.md`, ale nie w roadmapie.
- **Poprawka**: Zastąpić punkt kontrolny zapisem rozstrzygnięcia (404 z pełną stroną, wspólny
  `TeamNotFound.astro`) przy okazji archiwizacji.

- **Decyzja**: NAPRAWIONE — §S-07 roadmapy niesie teraz rozstrzygnięcie (404 z pełną stroną, wspólny `TeamNotFound.astro`), a „Niewiadome" jest odhaczone datą. `Status: in-progress` zostaje bez zmian — na `done` przestawia `/10x-archive`, zgodnie z wzorcem z S-04–S-06

### F8 — Asercje pozytywne biegną po surowym tekście migracji, mimo helpera w tym samym pliku

- **Ważność**: 👀 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/teams-policy-sql.test.ts:73-100
- **Szczegóły**: Trzy nowe przypadki używają `latestMigration()`, które zwraca surowy tekst pliku,
  podczas gdy ten sam plik ma `allMigrationsWithoutComments()` (l. 53), a bliźniaczy
  `src/lib/team-schema.test.ts:32-38` ma `statementsOf()` dzielący na polecenia. Dziś fałszywego
  zazielenienia nie ma — sprawdzone, żaden z siedmiu asertowanych ciągów nie występuje w komentarzu,
  a kontrola mutacyjna 2.6/2.7 czerwieni się poprawnie. Ryzyko jest przyszłe i dokładnie tej klasy,
  którą opisuje lekcja z S-06: proza w migracjach opisuje konstrukcje, których nie wykonuje.
- **Poprawka**: Przepuścić `latestMigration()` przez to samo strzyżenie komentarzy co
  `allMigrationsWithoutComments()`, albo dzielić na polecenia jak `statementsOf()`.
- **Decyzja**: NAPRAWIONE — wspólny `stripComments()` używany przez `latestMigration()` i `allMigrationsWithoutComments()`. Zweryfikowane: **zakomentowanie** linii `enable row level security` czerwieni teraz test (przed poprawką przechodziło na zielono). Nota w `plan.md` przy kroku 2.6 aktualizuje uzasadnienie kontroli mutacyjnej
