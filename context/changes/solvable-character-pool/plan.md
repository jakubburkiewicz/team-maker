# Plan implementacji: Rozwiązywalna pula 10–12 postaci wraz z perkami

## Przegląd

PRD nazywa dobór puli postaci **wiążącym warunkiem poprawności**, a nie kwestią smaku: sześć
postaci wnosi najwyżej sześć specjalizacji przy siedmiu kompetencjach, więc pula dobrana na oko
może uczynić łamigłówkę nierozwiązywalną, a produkt — niedomykalnym. Ta zmiana dostarcza dwanaście
postaci, każdą ze specjalizacją i trzema perkami, i **dowodzi** wyczerpującym przeszukaniem, że
istnieje skład domykający próg dwóch punktów w każdej z siedmiu kompetencji. Pula trafia do
Supabase migracją i zyskuje jedną funkcję odczytu, żeby S-01 zastał dane gotowe do użycia,
a nie surową tabelę.

## Analiza stanu obecnego

- **Kontrakt domenowy istnieje i jest domknięty.** `src/lib/domain/types.ts` definiuje
  `Character { id, specialization, perks }`, `Perk { id, competency }`, `CharacterPool`,
  `COMPETENCIES` (siedem nazw roboczych) oraz stałe `PERKS_PER_CHARACTER = 3`,
  `MAX_TEAM_SIZE = 6`, `MAX_PERKS_PER_MEMBER = 2`, `COMPETENCY_THRESHOLD = 2`.
  `evaluateTeam` (`src/lib/domain/evaluate-team.ts:60`) przyjmuje `(composition, pool)` i zwraca
  sumy, braki, naruszenia i werdykt. **Ta zmiana nie dotyka reguły** — wypełnia jej wejście.
- **Kontrakt nie niesie treści.** Ani `Character`, ani `Perk` nie mają nazwy ani opisu, których
  FR-013 wymaga w prawej kolumnie okna wyboru członka, a FR-014 przy etykietach perków.
- **Istniejąca pula to fixture testowy, nie produkt.** `src/lib/domain/test-fixtures.ts:12`
  zawiera osiem postaci i mówi o sobie wprost: „NIE jest to docelowa pula 10–12 postaci z PRD;
  ta powstaje w F-02 wraz z dowodem swojej rozwiązywalności".
- **Istnieje wzorzec walidacji puli.** Ustalenie F5 z przeglądu F-01 domknięto blokiem
  `describe("pula postaci")` w `src/lib/domain/evaluate-team.test.ts:35` — każda postać ma dokładnie
  `PERKS_PER_CHARACTER` perków o unikalnych identyfikatorach. Przegląd nazwał to „gotowym wzorcem
  dla puli docelowej".
- **Warstwa danych nie istnieje.** `supabase/` zawiera wyłącznie `config.toml` i `.gitignore` —
  zero migracji, zero wygenerowanych typów bazy, zero odwołań do tabel w `src/`. Ta zmiana tworzy
  **pierwszą migrację projektu**.
- **Projekt hostowany nie jest zlinkowany** (`context/deployment/deploy-plan.md:136`).
  W konsekwencji `supabase/seed.sql` i mechanizm `[db.seed]` odpadają z konstrukcji: działają
  wyłącznie przy lokalnym `supabase db reset` i nigdy nie trafiają na produkcję.
- **Twarda reguła czystości testów wiąże projekt danych.** `AGENTS.md`: nic pod testem nie może
  importować `astro:*` ani `@/lib/supabase`. CI (`.github/workflows/ci.yml`) nie ma Dockera ani
  stosu Supabase. Dowód rozwiązywalności — wiążący warunek z PRD — musi więc być czystym testem
  Vitest nad danymi w repozytorium, nie zapytaniem do bazy.
- **Naiwne przeszukanie pełne jest zbyt drogie.** Dla puli 12 postaci to C(12,6) = 924 podzbiory
  × 7⁶ = 117 649 wyborów perków ≈ 108 mln kombinacji.

## Pożądany stan końcowy

Istnieje dwanaście postaci z anglojęzyczną treścią, dostępnych aplikacji dwiema drogami zgodnymi
ze sobą z konstrukcji: jako stała `CHARACTER_POOL` w module domenowym (autorskie źródło prawdy)
oraz jako wiersze w tabelach `characters` i `perks` w Supabase, wstawione migracją wygenerowaną
z tej samej stałej. `npm test` orzeka — wyczerpująco, nie próbkowaniem — że istnieje co najmniej
jeden skład domykający próg, i że żaden skład bez perków go nie domyka. Jedna funkcja odczytu
zwraca `CharacterPool` gotowe do podania do `evaluateTeam`. Edycja treści puli, która zabije
rozwiązywalność albo rozjedzie plik z migracją, czerwieni zestaw.

Weryfikacja stanu końcowego: `npm test` zielone przy wyłączonym stosie Supabase i bez sieci;
`supabase db reset` lokalnie stawia obie tabele i wstawia dwanaście postaci wraz z ich perkami;
odczyt jako `authenticated` zwraca dwanaście postaci, jako `anon` — zero wierszy.

### Kluczowe odkrycia:

- `Character.perks` jest typu `readonly Perk[]` (`src/lib/domain/types.ts:53`), a `CharacterPool`
  to `readonly Character[]` — więc typ rozszerzający, który zawęża `perks` do
  `readonly PoolPerk[]`, jest przypisywalny do `CharacterPool` bez rzutowania. Treść wchodzi
  **bez zmian w regule i bez zmian w fixture'ach F-01**.
- Test może czytać pliki przez `node:fs` — to nie jest `astro:*` ani `@/lib/supabase`, więc
  kontrola zgodności migracji z pulą mieści się w twardej regule z `AGENTS.md`.
- Ustalenie F2 z przeglądu F-01 jest bezpośrednio przenośne: asercja wyrażona przez pinowaną
  wartość podąża za jej mutacją i przestaje cokolwiek wiązać. Dowód rozwiązywalności nie może
  opierać się wyłącznie na własnym solverze — musi przepuścić znaleziony skład przez
  `evaluateTeam`.
- `src/lib/supabase.ts:5` czyta sekrety wyłącznie z `astro:env/server` i zwraca `null`, gdy ich
  brak. Moduł odczytu puli **przyjmuje klienta jako argument** i sam nie importuje
  `@/lib/supabase` — dzięki temu jego czysta część pozostaje testowalna.

## Czego NIE robimy

- **Nie budujemy interfejsu** — okno wyboru członka (FR-013), wykres pajęczynowy (FR-016)
  i jakikolwiek ekran domenowy należą do S-01 i S-02.
- **Nie zapisujemy drużyn** — tabela `teams`, jej RLS i trasa zapisu należą do S-03.
- **Nie zmieniamy nazw siedmiu kompetencji** — zostają robocze; `COMPETENCIES` nietknięte.
- **Nie zmieniamy `evaluateTeam` ani `test-fixtures.ts`** — reguła i jej zestaw są zamknięte
  w F-01. `TEST_POOL` zostaje jako fixture przypadków brzegowych reguły; nowa pula ma własny
  zestaw.
- **Nie generujemy typów bazy** (`supabase gen types`) — wymaga zlinkowanego projektu albo
  działającego Dockera i nie ma dziś drugiego konsumenta. Moduł odczytu opisuje kształt wiersza
  ręcznie.
- **Nie dodajemy `zod`** — `AGENTS.md` zakazuje wprost bez osobnej prośby.
- **Nie stawiamy trasy diagnostycznej** pokazującej zasianą pulę — żaden FR jej nie żąda,
  a wymagałaby wpisu w `PROTECTED_ROUTES`.
- **Nie dotykamy `supabase config push`** — zakaz z `AGENTS.md` obowiązuje bez wyjątku, także
  w Fazie 4.
- **Nie dodajemy portretów, frakcji ani opisów perków** — PRD nie wymienia tych pól.

## Podejście do implementacji

Kolejność jest podyktowana jednym ograniczeniem: **wiążący dowód musi powstać, zanim dane
gdziekolwiek pojadą**. Pula rodzi się więc jako czysty TypeScript wraz z solverem i zestawem
weryfikacyjnym (Faza 1); dopiero udowodniona trafia do bazy migracją wygenerowaną z tej samej
stałej i pilnowaną testem zgodności (Faza 2); dopiero istniejąc w bazie zyskuje odczyt (Faza 3);
i dopiero działając lokalnie ląduje na projekcie hostowanym (Faza 4).

Zgodność dwóch reprezentacji jest utrzymywana **bez parsera SQL**: czysta funkcja renderuje blok
`INSERT` ze stałej, a test sprawdza, że plik migracji zawiera jej wynik dosłownie. Parser SQL
w teście byłby drugim kawałkiem logiki wymagającym zaufania dokładnie tam, gdzie dowodzimy
wiążącego warunku PRD.

Solver unika 108 mln kombinacji jedną obserwacją: **próg jest sufitem**. Punkty ponad dwa
w kompetencji nie zmieniają werdyktu, więc stan przeszukiwania to wektor braków przycięty do
zakresu 0–2 — 3⁷ = 2187 możliwych stanów zamiast nieograniczonej przestrzeni sum. Przeszukanie
z memoizacją po `(indeks postaci, liczba członków, stan braków)` zamyka się w rzędzie 10⁵ węzłów,
czyli w milisekundach, i jest **dokładne** — nie jest heurystyką ani próbkowaniem.

## Krytyczne szczegóły implementacji

- **Kolejność faz 1 → 2 jest wiążąca, nie porządkowa.** Migracja wygenerowana z puli, której
  rozwiązywalność nie została udowodniona, utrwala błąd w formie, którą trzeba potem naprawiać
  drugą migracją. Faza 2 nie zaczyna się przed zielonym dowodem z Fazy 1.
- **Migracja raz zastosowana na produkcji jest niezmienna.** Test zgodności celowo nie regeneruje
  pliku migracji — czerwieni się i wymusza dopisanie **nowej** migracji. Nie „naprawiaj" tego
  testu przez nadpisanie zastosowanego pliku.
- **Solver nie może być jedynym świadkiem.** Znaleziony skład musi zostać przepuszczony przez
  `evaluateTeam` i uzyskać `isValid: true`; inaczej zestaw dowodzi wyłącznie zgodności solvera
  z samym sobą (lekcja z ustalenia F2 przeglądu F-01).

---

## Faza 1: Pula i jej dowód

### Przegląd

Powstaje dwanaście postaci z anglojęzyczną treścią oraz wyczerpujący dowód, że pula jest
rozwiązywalna. Faza jest w całości czystym TypeScriptem — bez bazy, bez Astro, bez sieci.

### Wymagane zmiany:

#### 1. Typy niosące treść

**Plik**: `src/lib/domain/types.ts`

**Cel**: Dołożyć postaciom i perkom pola treściowe, których wymaga okno wyboru członka (FR-013)
i etykiety perków (FR-014), **bez dotykania reguły ani jej fixture'ów**.

**Umowa**: Dwa nowe typy rozszerzające istniejące, dopisane pod `Character`:
`PoolPerk extends Perk { name: string }` oraz
`PoolCharacter extends Character { name: string; description: string; perks: readonly PoolPerk[] }`.
Istniejące `Perk`, `Character`, `CharacterPool` i `COMPETENCIES` pozostają nietknięte.
Zawężenie `perks` jest legalne, bo pole jest `readonly` — dzięki temu `readonly PoolCharacter[]`
jest przypisywalne do `CharacterPool` i wchodzi wprost do `evaluateTeam`.

**Plik**: `src/lib/domain/index.ts`

**Cel**: Utrzymać barrel jako jedyne publiczne wejście modułu — istniejący test i fixture importują
z `@/lib/domain`, nie z głębokich ścieżek.

**Umowa**: Dopisać `export type { PoolCharacter, PoolPerk }` oraz `export { CHARACTER_POOL }`
(ten drugi po powstaniu pliku z pozycji 2). Solver z pozycji 3 **nie** wchodzi do barrela — tak jak
`test-fixtures.ts` ma wyłącznie konsumentów testowych i nie ma trafić do bundla aplikacji.

#### 2. Pula postaci

**Plik**: `src/lib/domain/character-pool.ts` (nowy)

**Cel**: Autorskie źródło prawdy dla całego projektu — dwanaście postaci z treścią, specjalizacją
i trzema perkami każda.

**Umowa**: Jeden eksport `export const CHARACTER_POOL: readonly PoolCharacter[]`.
Wiążące warunki doboru, wszystkie egzekwowane testem z pozycji 4:

- Dokładnie **dwanaście** postaci (górna granica przedziału 10–12 z PRD — im szersza pula, tym
  więcej rozwiązań, a persona główna to recenzent).
- Każda postać: dokładnie trzy perki (`PERKS_PER_CHARACTER`), identyfikatory perków unikalne
  **globalnie**, nie tylko w obrębie postaci — `evaluateTeam` dopasowuje perk po `id` w obrębie
  postaci, ale globalna unikalność jest warunkiem klucza głównego w tabeli `perks` z Fazy 2.
- Identyfikatory postaci i perków w kebab-case, stabilne — trafiają do bazy jako klucze główne
  i nie wolno ich później zmieniać bez migracji.
- Każda z siedmiu kompetencji jest specjalizacją **co najmniej jednej** postaci; przy dwunastu
  postaciach daje to pięć powtórzeń do rozdysponowania.
- Perki rozłożone tak, by każda kompetencja była osiągalna z perków wielu różnych postaci —
  to warunek kalibracji „komfortowo rozwiązywalna".
- Treść anglojęzyczna, w klimacie cyberpunkowym, spójna z istniejącą kopią interfejsu
  (`lang="en"`). Opis postaci: jedno zdanie. Nazwa perka: krótka fraza.

#### 3. Wyczerpujący solver

**Plik**: `src/lib/domain/solvability.ts` (nowy)

**Cel**: Rozstrzygnąć — dokładnie, nie heurystycznie — czy pula dopuszcza skład domykający próg,
i ile takich składów istnieje.

**Umowa**: Dwie czyste funkcje bez zależności poza `@/lib/domain/types`:

- `findThresholdSolution(pool: CharacterPool): TeamComposition | null` — pierwszy znaleziony skład
  domykający próg, albo `null`, gdy pula jest nierozwiązywalna. Wynik jest legalnym wejściem
  `evaluateTeam`: co najwyżej `MAX_TEAM_SIZE` różnych postaci, co najwyżej `MAX_PERKS_PER_MEMBER`
  perków u każdej.
- `countThresholdSolutions(pool: CharacterPool): number` — liczba wszystkich domykających par
  (podzbiór postaci, przypisanie perków), liczona wyczerpująco.

Obie przeszukują tę samą przestrzeń: dla każdej postaci decyzja „pomiń" albo „weź z jednym
z siedmiu dopuszczalnych podzbiorów perków" (∅, trzy pojedyncze, trzy pary).

Kluczowe dla wykonalności: **stanem jest wektor braków przycięty do zakresu 0–2**, nie wektor sum.
Punkty ponad próg nie zmieniają werdyktu, więc przestrzeń stanów ma 3⁷ = 2187 elementów i daje się
memoizować po `(indeks postaci, liczba wybranych członków, zakodowany stan braków)`. Bez tego
przycięcia przeszukanie ma ~10⁸ liści i nie nadaje się do testu.

#### 4. Zestaw weryfikacyjny puli

**Plik**: `src/lib/domain/character-pool.test.ts` (nowy)

**Cel**: Związać zachowaniem oba warunki, które PRD nazywa wiążącymi — poprawność kształtu puli
i jej rozwiązywalność — oraz kalibrację trudności.

**Umowa**: Przypadki nazwane po własnościach, nie po funkcjach. Wzorzec bloku
`describe("pula postaci")` z `src/lib/domain/evaluate-team.test.ts:35`. Progi i limity w asercjach
wyrażone **literałami z PRD**, nie stałymi z modułu (ustalenie F2 przeglądu F-01):

- Kształt: dwanaście postaci; każda ma dokładnie trzy perki; identyfikatory postaci unikalne;
  identyfikatory perków unikalne globalnie w całej puli; wszystkie siedem kompetencji występuje
  jako specjalizacja; treść niepusta u każdej postaci i każdego perka.
- Rozwiązywalność: `findThresholdSolution(CHARACTER_POOL)` zwraca skład, a ten skład przepuszczony
  przez `evaluateTeam` daje `violations: []` i `isValid: true` — **solver nie jest jedynym
  świadkiem**.
- Uczciwość solvera w drugą stronę: dla puli okrojonej tak, że rozwiązanie nie istnieje (np. pula
  bez żadnej postaci o jednej z kompetencji w specjalizacji i w perkach), `findThresholdSolution`
  zwraca `null`. Bez tego przypadku solver, który zawsze zwraca `null`, przechodziłby połowę
  zestawu.
- Właściwość liczbowa z PRD: żaden skład sześciu postaci **bez perków** nie domyka progu —
  sześć specjalizacji nie pokrywa siedmiu kompetencji. Wzorzec przypadku istnieje już
  w `src/lib/domain/evaluate-team.test.ts:88`. Przypadek jest prawdziwy dla **dowolnej** puli, więc
  nie waliduje treści `CHARACTER_POOL` — dokumentuje zapis PRD „perki muszą zostać użyte w każdym
  poprawnym rozwiązaniu" na danych docelowych. Komentarz w teście ma to mówić wprost, żeby nikt nie
  czytał go jako kontroli puli.
- Kalibracja: `countThresholdSolutions(CHARACTER_POOL)` przekracza ustalony **dolny próg**
  (rząd wielkości: dziesiątki rozwiązań). Asercja jest progiem, nie równością — edycja treści,
  która niczego nie łamie, nie czerwieni zestawu, a realny spadek rozwiązywalności tak.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Zestaw przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npx astro sync && npm run build`
- Moduł domenowy pozostaje czysty: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/`
  nie zwraca dopasowań (sprawdzane są linie importu, nie komentarze — komentarz o tym, czego moduł
  nie importuje, nie może zaczerwienić kryterium)
- Zestaw kończy się poniżej pięciu sekund — dowód wyczerpujący nie jest kosztem czasu

#### Ręczna weryfikacja:

- Kontrola mutacyjna: usunięcie jednego perka z dowolnej postaci w `CHARACTER_POOL` czerwieni
  przypadek kształtu; drzewo robocze przywrócone po próbie
- Kontrola mutacyjna: podmiana kompetencji w perkach tak, by jedna kompetencja zniknęła z całej
  puli, czerwieni przypadek rozwiązywalności; drzewo robocze przywrócone po próbie
- Treść dwunastu postaci przeczytana i zaakceptowana przez użytkownika — nazwy i opisy brzmią
  cyberpunkowo, a nie rodzajowo, i są spójne z anglojęzycznym interfejsem

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu automatycznych
weryfikacji zatrzymaj się na potwierdzenie treści przez użytkownika, zanim wygenerujesz z niej
migrację. Zmiana treści po Fazie 2 kosztuje drugą migrację.

---

## Faza 2: Schemat, RLS i zasiew w bazie

### Przegląd

Pula — już udowodniona — trafia do Supabase. Powstaje pierwsza migracja projektu: enum siedmiu
kompetencji, dwie tabele, polityki dostępu wyłącznie do odczytu i wiersze wygenerowane ze stałej
z Fazy 1, pilnowane testem zgodności.

### Wymagane zmiany:

#### 1. Schemat i polityki dostępu

**Plik**: `supabase/migrations/<timestamp>_character_pool_schema.sql` (nowy)

**Cel**: Postawić tabele puli i domknąć je na zapis po stronie bazy, żeby Non-Goal PRD
„tworzenie własnych postaci przez gracza" był egzekwowany, a nie deklarowany.

**Umowa**:

- Typ `create type public.competency as enum (...)` z dokładnie siedmioma wartościami
  odpowiadającymi `COMPETENCIES` z `src/lib/domain/types.ts:12`, w tej samej kolejności.
- `public.characters`: `id text primary key`, `name text not null`, `description text not null`,
  `specialization public.competency not null`, `sort_order int not null` z unikalnością —
  kolejność listy w lewej kolumnie okna wyboru (FR-013) musi być deterministyczna, a nie
  przypadkowa.
- `public.perks`: `id text primary key`,
  `character_id text not null references public.characters(id) on delete cascade`,
  `name text not null`, `competency public.competency not null`, `sort_order int not null`,
  unikalność pary `(character_id, sort_order)`.
- RLS włączone na obu tabelach. **Wyłącznie** polityka `for select to authenticated using (true)`
  na każdej z nich. Zero polityk `insert`/`update`/`delete` — pula jest zamknięta, a cała
  aplikacja stoi za logowaniem (FR-004), więc `anon` nie dostaje nic.
- Indeks na `perks(character_id)`.

#### 2. Renderer bloku INSERT

**Plik**: `src/lib/domain/character-pool-sql.ts` (nowy)

**Cel**: Dać jedno deterministyczne odwzorowanie stałej `CHARACTER_POOL` na tekst SQL — używane
raz przy pisaniu migracji i przy każdym uruchomieniu testu zgodności.

**Umowa**: Dwie czyste funkcje bez zależności poza typami domenowymi:

- `renderCharacterPoolInserts(pool: readonly PoolCharacter[]): string` — blok `INSERT` dla obu
  tabel w formie **upsertu**: `insert into … values … on conflict (id) do update set …` dla każdej
  kolumny treściowej. Ten sam tekst obsługuje pierwszy zasiew i każdą późniejszą korektę treści,
  bez `delete`, które po S-03 zderzyłoby się z kluczem obcym z `teams` do `characters(id)`.
- `renderCompetencyEnum(competencies: typeof COMPETENCIES): string` — pełne polecenie
  `create type public.competency as enum (...)` z wartościami w kolejności `COMPETENCIES`.
  Migracja schematu zawiera dosłownie jego wynik, tak samo jak migracja zasiewowa zawiera wynik
  pierwszej funkcji — jeden wzorzec zgodności dla obu plików, bez parsera SQL.

Wynik obu jest w pełni deterministyczny: kolejność postaci i perków z tablicy wejściowej,
`sort_order` z indeksu, ustalony sposób cytowania łańcuchów (apostrof podwojony), ustalone wcięcia
i separatory. Dwa wywołania na tych samych danych dają znak w znak ten sam tekst — na tym opiera
się kontrola z pozycji 4.

#### 3. Migracja zasiewowa

**Plik**: `supabase/migrations/<timestamp>_character_pool_seed.sql` (nowy)

**Cel**: Wstawić dwanaście postaci i trzydzieści sześć perków do bazy — także na produkcji, gdzie
mechanizm `[db.seed]` nigdy nie dociera.

**Umowa**: Plik zawiera **dosłowny** wynik `renderCharacterPoolInserts(CHARACTER_POOL)` — dwa
polecenia `insert into … on conflict (id) do update` (najpierw `characters`, potem `perks`,
ze względu na klucz obcy).
Migracja jest osobna od schematu, bo to ona będzie zastępowana przy każdej przyszłej zmianie
treści puli, podczas gdy schemat zostaje.

#### 4. Kontrola zgodności puli z migracją

**Plik**: `src/lib/domain/character-pool-sql.test.ts` (nowy)

**Cel**: Uniemożliwić cichy rozjazd autorskiego źródła prawdy z tym, co realnie wjeżdża do bazy.

**Umowa**: Test czyta migrację zasiewową przez `node:fs` — dozwolone, bo to nie jest `astro:*`
ani `@/lib/supabase` — i sprawdza, że jej treść **zawiera dosłownie** wynik
`renderCharacterPoolInserts(CHARACTER_POOL)`. Plik lokalizowany po sufiksie
`_character_pool_seed.sql` w `supabase/migrations/`; gdy pasuje więcej niż jeden, brany jest
najnowszy po nazwie — tak działa też sam Supabase. Test **nie zapisuje** pliku migracji.

Dodatkowo jeden przypadek na zgodność enuma: migracja schematu (lokalizowana po sufiksie
`_character_pool_schema.sql`) **zawiera dosłownie** wynik `renderCompetencyEnum(COMPETENCIES)`.
Sama liczba wartości nie wystarcza — siedem wartości o innych nazwach przeszłoby, a rozjazd nazw
ujawniłby się dopiero jako ciche `NaN` w sumach `evaluateTeam`.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Zestaw przechodzi, w tym kontrola zgodności: `npm test`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npx astro sync && npm run build`
- Testy nadal nie sięgają po Supabase: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/`
  nie zwraca dopasowań

#### Ręczna weryfikacja:

- `supabase start && supabase db reset` stawia obie tabele i obie migracje bez błędu
- `select count(*) from characters` zwraca 12, `select count(*) from perks` zwraca 36
- Odczyt przez PostgREST z tokenem `authenticated` zwraca dwanaście postaci; ten sam odczyt
  z kluczem `anon` zwraca zero wierszy — RLS działa w obie strony
- Próba `insert` do `characters` z rolą `authenticated` zostaje odrzucona przez RLS
- Kontrola mutacyjna: zmiana jednego znaku w opisie postaci w `CHARACTER_POOL` czerwieni kontrolę
  zgodności; drzewo robocze przywrócone po próbie

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu automatycznych
weryfikacji zatrzymaj się na ręczne potwierdzenie działania stosu lokalnego, zanim przejdziesz
do odczytu.

---

## Faza 3: Odczyt puli z bazy

### Przegląd

Powstaje jedna funkcja zwracająca `CharacterPool` z bazy, gotowe do podania do `evaluateTeam`.
Mapowanie wiersz → `PoolCharacter` jest wydzielone jako czyste i testowane bez Supabase.

### Wymagane zmiany:

#### 1. Odczyt i mapowanie

**Plik**: `src/lib/character-pool-repo.ts` (nowy)

**Cel**: Dać S-01 pulę gotową do użycia zamiast surowej tabeli, i to w jednym miejscu, żeby
mapowanie nie powielało się na każdym ekranie.

**Umowa**: Moduł leży w `src/lib/`, a nie w `src/lib/domain/` — sięga po bazę, więc nie należy
do czystej reguły.

- `getCharacterPool(supabase: SupabaseClient): Promise<readonly PoolCharacter[]>` — **przyjmuje
  klienta jako argument i nie importuje `@/lib/supabase`**. Dzięki temu obsługa przypadku
  `createClient() === null` zostaje po stronie wywołującego, dokładnie jak w `src/middleware.ts:7`
  i `src/pages/api/auth/signin.ts`, a moduł nie wciąga `astro:env/server`.
- Jedno zapytanie z zagnieżdżonym wyborem po kluczu obcym, uporządkowane po `sort_order`
  na obu poziomach — kolejność listy postaci i kolejność perków muszą być deterministyczne
  (FR-013, FR-014).
- Kształt wiersza opisany ręcznie napisanym interfejsem w tym pliku; `supabase gen types` nie
  wchodzi do projektu (patrz „Czego NIE robimy").
- `mapPoolRows(rows): readonly PoolCharacter[]` — **eksportowana, czysta**, bez `async`
  i bez zależności od Supabase. To ona jest przedmiotem testu. Wartości `specialization`
  i `competency` z wiersza są **sprawdzane przynależnością do `COMPETENCIES`**, nie rzutowane:
  wartość spoza listy rzuca błąd z nazwą wiersza i wartością. Bez tego nieznana kompetencja
  przechodzi do `evaluateTeam`, która dolicza `scores[x] += 2` pod kluczem, którego pętla progu
  nie odwiedza — `NaN` bez naruszenia i bez błędu.
- Błąd zapytania jest rzucany, nie połykany: pusta pula wygląda w interfejsie identycznie jak
  awaria bazy, a S-01 musi umieć je rozróżnić.

#### 2. Test mapowania

**Plik**: `src/lib/character-pool-repo.test.ts` (nowy)

**Cel**: Związać kontrakt mapowania bez uruchamiania Supabase — zgodnie z twardą regułą
z `AGENTS.md`.

**Umowa**: Testowane jest wyłącznie `mapPoolRows` na ręcznie zbudowanych wierszach. Przypadki:
wiersze odwzorowują się na `PoolCharacter` z zachowaniem kolejności; wynik jest legalnym wejściem
`evaluateTeam` (przepuszczony przez nią nie generuje `unknown-character` ani `unknown-perk`);
postać bez perków nie wywraca mapowania; wiersz z kompetencją spoza `COMPETENCIES` rzuca błąd
zamiast przejść dalej. Plik testu **nie importuje** `@/lib/supabase`.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Zestaw przechodzi: `npm test`
- Lint przechodzi: `npm run lint`
- Build przechodzi: `npx astro sync && npm run build`
- Żaden plik testowy nie sięga po Supabase: `grep -rl "lib/supabase" --include='*.test.ts' src`
  nie zwraca dopasowań (forma niezależna od powłoki — glob `**` w bashu 3.2 bez `globstar` nie
  schodzi do podkatalogów i pominąłby `src/lib/domain/`)

#### Ręczna weryfikacja:

- To samo zapytanie, które składa `getCharacterPool`, uruchomione w Supabase Studio na stosie
  lokalnym zwraca dwanaście postaci, każdą z trzema perkami, w kolejności `sort_order`
- Kształt odpowiedzi zgadza się z interfejsem wiersza opisanym w module — nazwy pól, zagnieżdżenie
  perków, typy

---

## Faza 4: Zastosowanie na projekcie hostowanym

### Przegląd

Migracje z Fazy 2 trafiają do produkcyjnego projektu Supabase. Faza jest **w całości ręczna
i wykonywana przez użytkownika** — dotyka produkcji, a projekt hostowany nie jest dziś zlinkowany.

### Wymagane zmiany:

Żadnych zmian w repozytorium. Faza wykonuje kroki operacyjne na projekcie hostowanym.

**Umowa**: Jedyna dozwolona ścieżka to `supabase link --project-ref <ref>` a następnie
`supabase db push`, które stosuje wyłącznie pliki z `supabase/migrations/`.
**`supabase config push` nie zostaje uruchomione ani przed, ani po** — zakaz z `AGENTS.md`
obowiązuje bez wyjątku; wypchnęłoby `site_url = "http://127.0.0.1:3000"`,
`additional_redirect_urls` i limit `email_sent = 2` na produkcję, kierując produkcyjne linki
mailowe na localhost i psując potwierdzanie adresu (FR-001).

Zlinkowanie projektu zmienia stan opisany w `context/deployment/deploy-plan.md:136` („projekt
hostowany nie jest zlinkowany"). Po udanym `db push` zaktualizuj to zdanie wraz z notatką, że
zakaz `config push` obowiązuje nadal — a teraz jest łatwiejszy do przypadkowego uruchomienia.

Domknij też wpis F-02 w `context/foundation/roadmap.md` (linie ~135–159): zdanie „Fundament nie
buduje warstwy danych" przestało być prawdą decyzją użytkownika z sesji planowania — warstwa danych
(pierwsza migracja, RLS, odczyt) powstaje w tej zmianie; obie „Niewiadome" mają rozstrzygnięcia
(pula w bazie z autorskim źródłem prawdy w repo; treść generuje agent po angielsku, użytkownik
recenzuje). We wpisie S-03 odnotuj, że katalog `supabase/migrations/`, wzorzec RLS i warsztat
`supabase start`/`db push` już istnieją. Niedomknięta mapa drogowa była ustaleniem F1 przeglądu
implementacji F-01 — to samo przeoczenie nie może się powtórzyć.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Brak. Faza nie zmienia repozytorium poza notatką w dokumentacji wdrożenia.

#### Ręczna weryfikacja:

- `supabase db push` kończy się bez błędu i wypisuje obie migracje jako zastosowane
- W dashboardzie produkcyjnego projektu istnieją tabele `characters` i `perks`, z dwunastoma
  i trzydziestoma sześcioma wierszami
- RLS na obu tabelach jest włączone, a lista polityk zawiera wyłącznie po jednej polityce `SELECT`
- `supabase config push` **nie** został uruchomiony; potwierdzanie adresu e-mail w produkcji nadal
  działa (rejestracja testowa kończy się mailem z linkiem prowadzącym na produkcyjny adres,
  nie na localhost)
- `context/deployment/deploy-plan.md:136` odzwierciedla nowy stan zlinkowania
- Wpis F-02 w `context/foundation/roadmap.md` odzwierciedla decyzję o warstwie danych, obie
  Niewiadome są rozstrzygnięte, a wpis S-03 odnotowuje istniejący warsztat Supabase

---

## Strategia testowania

### Testy jednostkowe:

- Kształt puli: liczność, komplet perków, unikalność identyfikatorów, pokrycie siedmiu
  kompetencji specjalizacjami, niepusta treść
- Rozwiązywalność: istnienie składu domykającego próg, potwierdzone niezależnie przez
  `evaluateTeam`
- Uczciwość solvera: pula spreparowana jako nierozwiązywalna daje `null`
- Właściwość liczbowa PRD: brak rozwiązania bez użycia perków
- Kalibracja: liczba rozwiązań powyżej dolnego progu
- Zgodność stałej z migracją zasiewową: dosłowne zawieranie wyrenderowanego bloku `INSERT`
- Zgodność enuma `competency` z `COMPETENCIES`: dosłowne zawieranie wyrenderowanego `create type`
- Mapowanie wiersz → `PoolCharacter`, w tym zgodność z wejściem `evaluateTeam` i odrzucenie
  kompetencji spoza `COMPETENCIES`

### Testy integracyjne:

Brak zautomatyzowanych — z konstrukcji. Stos Supabase wymaga Dockera, którego CI nie ma,
a twarda reguła z `AGENTS.md` zakazuje testom sięgania po Supabase. Warstwa bazy jest weryfikowana
ręcznie na stosie lokalnym (Faza 2) i na produkcji (Faza 4).

### Kroki testowania ręcznego:

1. `supabase start`, następnie `supabase db reset` — obie migracje stosują się bez błędu
2. `select count(*)` na obu tabelach — 12 i 36
3. Odczyt z tokenem `authenticated` — dwanaście postaci; z kluczem `anon` — zero wierszy
4. Próba `insert` do `characters` jako `authenticated` — odrzucona przez RLS
5. Zapytanie z zagnieżdżonym wyborem perków w Studio — kolejność zgodna z `sort_order`
6. Mutacja jednego znaku w treści `CHARACTER_POOL` — kontrola zgodności czerwieni się; przywróć
7. Usunięcie perka z jednej postaci — przypadek kształtu czerwieni się; przywróć
8. Wyzerowanie jednej kompetencji w całej puli — przypadek rozwiązywalności czerwieni się; przywróć

## Uwagi dotyczące wydajności

Jedyne miejsce z realnym budżetem to solver. Naiwne przeszukanie dla dwunastu postaci ma
~10⁸ liści i uczyniłoby zestaw bezużytecznym. Przycięcie wektora braków do progu ogranicza
przestrzeń stanów do 3⁷ = 2187, a memoizacja po `(indeks, liczba członków, stan)` — do rzędu
10⁵ węzłów. Solver działa wyłącznie w teście; nie trafia na ścieżkę żądania, więc wymaganie
pozafunkcjonalne „poniżej 200 ms od wyboru" (FR-016) go nie dotyczy — to `evaluateTeam` je nosi
i pozostaje nietknięte.

Odczyt puli to jedno zapytanie o dwanaście wierszy z zagnieżdżeniem. Bez cache'owania: pula jest
mała, a dokładanie warstwy cache przed pierwszym ekranem, który jej używa, byłoby optymalizacją
bez pomiaru.

## Uwagi dotyczące migracji

- To **pierwsze migracje w projekcie**. Katalog `supabase/migrations/` powstaje wraz z nimi.
- Podział na migrację schematu i migrację zasiewową jest celowy: przy zmianie treści puli
  zastępowana jest wyłącznie ta druga, a schemat zostaje.
- Migracja raz zastosowana na produkcji jest niezmienna. Zmiana treści puli po Fazie 4 oznacza
  **nową** migrację zasiewową z tym samym wyrenderowanym blokiem upsert (plus jawne `delete`
  wyłącznie dla identyfikatorów usuniętych z puli — dopiero wtedy klucz obcy z `teams` po S-03
  ma coś do powiedzenia), a nie edycję zastosowanego pliku ani „skasuj wszystko i wstaw od nowa".
  Kontrola zgodności z Fazy 2 lokalizuje najnowszą migrację zasiewową po nazwie, więc obsługuje
  ten obieg bez zmian.
- `supabase/seed.sql` nie jest używany. Mechanizm `[db.seed]` z `config.toml` działa wyłącznie
  przy lokalnym `db reset` i nie dociera na produkcję.

## Referencje

- Element mapy drogowej: `context/foundation/roadmap.md` → F-02
- Wymaganie wstępne: `context/archive/2026-08-30-domain-rule-verification-harness/plan.md`
- Kontrakt domenowy: `src/lib/domain/types.ts:44-63`, `src/lib/domain/evaluate-team.ts:60`
- Wzorzec walidacji puli: `src/lib/domain/evaluate-team.test.ts:35-42`
- Wzorzec właściwości liczbowej: `src/lib/domain/evaluate-team.test.ts:88-100`
- Wzorzec null-check klienta Supabase: `src/middleware.ts:7`
- Stan zlinkowania projektu hostowanego: `context/deployment/deploy-plan.md:136`
- Lekcja o asercjach podążających za pinowaną wartością:
  `context/archive/2026-08-30-domain-rule-verification-harness/reviews/impl-review.md` → F2

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Pula i jej dowód

#### Automatyczne

- [ ] 1.1 Zestaw przechodzi: `npm test`
- [ ] 1.2 Lint przechodzi: `npm run lint`
- [ ] 1.3 Build przechodzi: `npx astro sync && npm run build`
- [ ] 1.4 Moduł domenowy pozostaje czysty: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/` bez dopasowań
- [ ] 1.5 Zestaw kończy się poniżej pięciu sekund

#### Ręczne

- [ ] 1.6 Mutacja: usunięty perk czerwieni przypadek kształtu; drzewo przywrócone
- [ ] 1.7 Mutacja: zniknięcie kompetencji z puli czerwieni przypadek rozwiązywalności; drzewo przywrócone
- [ ] 1.8 Treść dwunastu postaci przeczytana i zaakceptowana przez użytkownika

### Faza 2: Schemat, RLS i zasiew w bazie

#### Automatyczne

- [ ] 2.1 Zestaw przechodzi, w tym kontrola zgodności: `npm test`
- [ ] 2.2 Lint przechodzi: `npm run lint`
- [ ] 2.3 Build przechodzi: `npx astro sync && npm run build`
- [ ] 2.4 Testy nadal nie sięgają po Supabase: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/` bez dopasowań

#### Ręczne

- [ ] 2.5 `supabase start && supabase db reset` stosuje obie migracje bez błędu
- [ ] 2.6 `characters` ma 12 wierszy, `perks` ma 36
- [ ] 2.7 Odczyt jako `authenticated` zwraca 12 postaci, jako `anon` zero wierszy
- [ ] 2.8 Próba `insert` jako `authenticated` odrzucona przez RLS
- [ ] 2.9 Mutacja: zmiana znaku w treści puli czerwieni kontrolę zgodności; drzewo przywrócone

### Faza 3: Odczyt puli z bazy

#### Automatyczne

- [ ] 3.1 Zestaw przechodzi: `npm test`
- [ ] 3.2 Lint przechodzi: `npm run lint`
- [ ] 3.3 Build przechodzi: `npx astro sync && npm run build`
- [ ] 3.4 Żaden plik testowy nie sięga po Supabase: `grep -rl "lib/supabase" --include='*.test.ts' src` bez dopasowań

#### Ręczne

- [ ] 3.5 Zapytanie `getCharacterPool` w Studio zwraca 12 postaci z perkami w kolejności `sort_order`
- [ ] 3.6 Kształt odpowiedzi zgadza się z interfejsem wiersza w module

### Faza 4: Zastosowanie na projekcie hostowanym

#### Ręczne

- [ ] 4.1 `supabase db push` stosuje obie migracje na projekcie hostowanym bez błędu
- [ ] 4.2 Tabele `characters` i `perks` istnieją w produkcji z 12 i 36 wierszami
- [ ] 4.3 RLS włączone, wyłącznie po jednej polityce `SELECT` na tabelę
- [ ] 4.4 `supabase config push` nie uruchomiony; potwierdzanie adresu w produkcji nadal działa
- [ ] 4.5 `context/deployment/deploy-plan.md` odzwierciedla nowy stan zlinkowania
- [ ] 4.6 Wpis F-02 w `roadmap.md` odzwierciedla decyzję o warstwie danych, Niewiadome rozstrzygnięte, S-03 odnotowuje istniejący warsztat Supabase
