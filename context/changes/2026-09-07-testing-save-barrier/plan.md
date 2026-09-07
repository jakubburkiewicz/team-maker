# Bariera serwerowa zapisu drużyny — plan implementacji

## Przegląd

Pierwszy w tym projekcie test **wykonujący** złożenie trasy API. Faza dowodzi, że oba tory zapisu
składu — `POST /api/teams` i `POST /api/teams/[id]` — wołają bramkę `gateTeamSubmission`
**przed** utrwaleniem, więc skład łamiący próg albo limity nie zostawia wiersza, choćby żądanie
ominęło interfejs. Pokrywa ryzyka #1 i #6 z `context/foundation/test-plan.md` §2.

Faza nie dokłada bariery — bariera stoi. Dokłada **pierwszy automat nad nią**, bo dziś nic nie
wiąże faktu, że trasa tę bramkę woła.

## Analiza bieżącego stanu

Reguła i bramka mają gęste pokrycie jednostkowe: `evaluateTeam` egzekwuje próg i sześć naruszeń
limitów ([evaluate-team.ts:55-129](src/lib/domain/evaluate-team.ts#L55-L129)), a `gateTeamSubmission`
składa nad nią parser kształtu z limitem ładunku ([team-submission.ts:133-145](src/lib/team-submission.ts#L133-L145)).
`src/lib/team-submission.test.ts` ma 24 przypadki, `src/lib/domain/evaluate-team.test.ts` — komplet reguły.

Czego nie ma: **żaden z 17 plików `*.test.ts` nie importuje niczego z `src/pages/`.** Usunięcie
trzech linii `if (!gate.ok) return …` z [index.ts:64-69](src/pages/api/teams/index.ts#L64-L69)
zostawia `npm test` w całości zielone, a produkt utrwala dowolny skład. Cała siedmiokrokowa
sekwencja trasy — sesja, klient, `formData()`, pole, pula, bramka, repo — nie ma ani jednej asercji.

Baza nie jest drugą linią obrony i to jest decyzja, nie przeoczenie: jedyne ograniczenie na
`composition` to `check (jsonb_typeof(composition) = 'array')`
([20260905185700_teams_schema.sql:22](supabase/migrations/20260905185700_teams_schema.sql#L22)).
Baza egzekwuje wyłącznie własność (RLS) i niezmienność nazwy (kolumnowy `grant update (composition)`).
**Jedyną barierą progu i limitów jest Worker.**

Wzorca do skopiowania nie ma: `grep` po wszystkich 17 plikach testowych daje **zero** trafień na
`vi.mock`, `vi.fn`, `vi.hoisted`, `SupabaseClient`, `as unknown as`. Osprzęt powstaje od zera i to
on jest właściwym kosztem tej fazy.

## Pożądany stan końcowy

`src/lib/team-save-route.test.ts` wykonuje obie trasy zapisu w Node i wiąże:

- **skutek**: żądanie łamiące próg albo którykolwiek z sześciu limitów **nie zostawia zapisu** —
  dziennik atrapy klienta jest pusty;
- **kontrakt odmowy**: każda odmowa to redirect 302 z `?error=`, zero JSON, żaden `throw` nie
  wychodzi z handlera;
- **glue**: siedem kroków sekwencji, w tym gałęzie chroniące przed 500 w Workerze.

`scripts/probe-save-barrier.sh` nakłada wersjonowaną łatkę `scripts/probe-save-barrier.patch`
(zapis przed odmową), uruchamia `npm test`, wymaga czerwieni i cofa łatkę — sonda **i sama mutacja**
są w repozytorium, więc `/10x-impl-review` i każda przyszła faza mogą ją uruchomić **dosłownie**
i przeczytać, co dokładnie rozbraja.

`context/foundation/test-plan.md` §6.2 przestaje brzmieć `TBD` i staje się kanoniczną odpowiedzią
na „jak dodać test toru zapisu w tym projekcie", a §5 bramka integracyjna przechodzi z
`required after §3 Phase 1` w `required (wired)`.

Weryfikacja stanu końcowego: `npm test` zielone (17 → 18 plików), `scripts/probe-save-barrier.sh`
czerwieni na mutacji i przywraca drzewo do czystego stanu, `npm run lint` i `npm run build` zielone.

### Kluczowe odkrycia

- **Sonda na prawdziwej konfiguracji repozytorium przeszła** (2026-09-07, przed napisaniem planu):
  `vi.hoisted` + `vi.mock("@/lib/supabase", …)` + `await import("@/pages/api/teams/index")`
  wykonuje całą sekwencję do redirectu **bez żadnej zmiany w `vitest.config.ts`**. Atrapa
  w kształcie „`from(table)` → thenable builder" obsłużyła oba zapytania trasy: `getCharacterPool`
  (`.select().order().order()` + `await`) i `createTeam` (`.insert().select().single()`).
- **Wariant rozbrajający czerwieni** — po usunięciu `if (!gate.ok)` padła dokładnie asercja
  `expect(client.writes).toEqual([])`. Osprzęt wiąże.
- **Kanoniczną mutacją jest przesunięcie zapisu przed odmowę, nie usunięcie warunku.** Usunięcie
  `if (!gate.ok)` psuje też typy (`gate.composition` na unii `SubmissionResult`) — ale **żadna bramka
  CI tego nie łapie**: [ci.yml:18-21](.github/workflows/ci.yml#L18-L21) uruchamia `astro sync`,
  `lint`, `test` i `build`; `astro build` nie typuje, a `astro check` nie jest ani krokiem CI, ani
  skryptem npm. Wariant „usuń warunek" przeszedłby więc do produkcji na zielono i łapie go dziś
  wyłącznie test toru. Mutacja kanoniczna jest mimo to inna — poprawna typowo, żeby czerwień sondy
  nie mogła pochodzić z typów zamiast z asercji — a jej dokładny kształt jest zamrożony
  w `scripts/probe-save-barrier.patch` (treść w „Krytycznych szczegółach implementacji").
- **Wariant kanoniczny nie był jeszcze sondowany.** Sonda 2026-09-07 czerwieniła na *usunięciu*
  warunku, nie na przesunięciu zapisu. `lessons.md` §„Strażnik grepowy nad JSX/TS" — „sonduj
  wariantem rozbrajającym, nie tym, który łapiesz" — więc pierwszym zadaniem Fazy 1 po postawieniu
  osprzętu jest potwierdzenie czerwieni **tej** mutacji; dopóki go nie ma, faza nie jest domknięta.
- **Astro traktuje każdy `.ts` w `src/pages/` jako endpoint** — plik testowy obok trasy stałby się
  trasą `/api/teams/index.test` i wszedł do builda produkcyjnego. Test idzie do `src/lib/`.
- **Pułapka wyroczni**: `scores` z `evaluateTeam` odzwierciedla **surowy wybór**, także odrzucony
  przez limity ([evaluate-team.ts:24-33](src/lib/domain/evaluate-team.ts#L24-L33)) — trzeci perk
  dolicza punkt, powtórzona postać dolicza specjalizację dwa razy. Asercja wyprowadzona ze `scores`
  zamiast ze skutku w dzienniku zapisów mierzy nie to, co deklaruje.
- **Wszystkie naruszenia limitów zwijają się do `below-threshold`**
  ([team-submission.ts:140-142](src/lib/team-submission.ts#L140-L142)), więc żądanie z siódmym
  członkiem dostaje komunikat o progu kompetencji. Test **nie odróżni ryzyka #1 od #6 po komunikacie** —
  rozróżnia po tym, czy wiersz powstał.
- **Realna powierzchnia ryzyk #1 i #6 to spreparowane żądanie HTTP do własnej trasy** z ważnym
  ciasteczkiem, nie PostgREST: `SUPABASE_KEY` jest `context: "server", access: "secret"`
  ([astro.config.mjs:29](astro.config.mjs#L29)) i nie trafia do przeglądarki. Dowód nie wymaga
  prawdziwego Postgresa — bariera stoi **przed** bazą.
- **Baza sondy**: `a392c62` (`git rev-parse --short HEAD` z chwili planowania). Każde kryterium
  porównujące ze stanem sprzed zmiany cytuje ten SHA, nigdy `HEAD` —
  `lessons.md` §„Linię bazową strażnika kotwicz na jawnym SHA".

## Czego NIE robimy

- **Nie dotykamy `vitest.config.ts` ani `.github/workflows/ci.yml`.** Sonda dowiodła, że nie trzeba;
  `test-plan.md` §4 zapisał to wprost. `npm test` zostaje jednym poleceniem bez przegród i sekretów.
- **Nie zmieniamy ani jednej linii w `src/pages/`, `src/lib/` poza nowymi plikami testowymi.**
  Faza jest testowa. Jeśli test ujawni usterkę produktu, otwiera się osobna zmiana.
- **Nie testujemy `POST /api/teams/[id]/delete`** — nie czyta ciała i nie zna reguły domenowej, więc
  dla ryzyk #1/#6 wnosi zero. Jego miejsce to Faza 2 wdrożenia (izolacja, cztery operacje).
- **Nie dopisujemy przypadków do `src/lib/team-submission.test.ts`.** Ten plik nie ma dziś przypadku
  `duplicate-character` ani `unknown-perk` ([research.md:180-184](context/changes/2026-09-07-testing-save-barrier/research.md#L180-L184)) —
  to pokrycie warstwy **już testowanej** i nie wolno mu podszyć się pod dowód bariery; wchodzi do
  §6.7 test-planu jako znany dług. **Na poziomie trasy oba rodzaje są w zakresie** (Faza 2 pkt 2):
  bramka je odrzuca przez `isValid`, więc test toru wiąże je tak samo jak pozostałe cztery.
- **Nie wiążemy kolejności `violations`** przez `toEqual` — kolejność nie jest widoczna dla
  użytkownika ani dla żadnego ryzyka z §2.
- **Nie testujemy `createTeam` / `updateTeam` przeciwko atrapie jako funkcji.** To byłby pomiar
  atrapy własną atrapą — kształt zapytania przepisany z implementacji, czyli lustro.
- **Nie stawiamy prawdziwego Postgresa.** Poza zasięgiem CI ([ci.yml:21](.github/workflows/ci.yml#L21)
  woła gołe `npm test`) i zbędny — §6 badania.
- **Nie podpinamy sondy rozbrajającej do CI.** Łatanie plików źródłowych na runnerze to nowa klasa
  awarii zielonego builda; sonda zostaje kryterium ręcznym.

## Podejście do implementacji

Kolejność jest podyktowana jednym: **osprzęt jest drogi, asercje są tanie.** Faza 1 stawia atrapy
i **od razu** dowodzi skryptem sondy, że one wiążą — bo osprzęt, którego czerwieni nie wykazano,
jest dekoracją (`test-plan.md` §1, zasada przekrojowa). Dopiero na przesondowanym osprzęcie Fazy 2
i 3 dokładają przypadki, każdy po kilka linii.

Wyrocznia asercji pochodzi z **Guardraila PRD** („każda z 7 kompetencji ≥ 2 pkt", „max 6 członków",
„max 2 perki", „bez powtórzeń"), nie z kodu pod testem. Progi w asercjach są literałami PRD (`2`, `6`),
identyfikatory postaci i perków — z `CHARACTER_POOL`, nigdy z palca.

## Krytyczne szczegóły implementacji

**Treść mutacji jest artefaktem, nie prozą.** „Przestawienie `createTeam` przed bramkę" **nie jest
przestawieniem linii**: `createTeam` konsumuje `gate.composition`, którego przed bramką nie ma
([index.ts:72](src/pages/api/teams/index.ts#L72)). Mutacja musi więc dopisać kod, i to poprawny
typowo, bez nowego importu. Kanoniczny kształt — **zapis wykonuje się, zanim odmowa wróci**:

```ts
  const gate = gateTeamSubmission(raw, pool);

  try {
    const team = await createTeam(supabase, {
      userId: user.id,
      composition: gate.ok ? gate.composition : [],
    });
    if (!gate.ok) {
      return rejectToComposer(
        context,
        gate.reason.kind === "invalid-payload" ? INVALID_PAYLOAD_MESSAGE : BELOW_THRESHOLD_MESSAGE,
      );
    }
    return context.redirect(`/teams/${team.id}/embark`);
  } catch (error) {
```

Ten hunk mieszka w `scripts/probe-save-barrier.patch` i jest nakładany przez `git apply`, nie przez
`sed`. Trzy powody: łatka jest recenzowalna (widać, co dokładnie rozbraja), `git apply -R` cofa ją
**dokładnie**, a nie regexem odtwarzającym oryginał, i przy pierwszym refaktorze `index.ts` łatka
przestaje się nakładać głośno, zamiast po cichu mutować nie to miejsce.

**Cykl życia sondy.** Skrypt modyfikuje plik śledzony przez git. Musi cofnąć łatkę w `trap`
(`EXIT`/`INT`/`TERM`), a nie na końcu szczęśliwej ścieżki — przerwanie w połowie zostawiłoby
rozbrojoną trasę w drzewie roboczym. Skrypt odmawia startu na brudnym drzewie i przerywa
niezerowo, gdy `git apply` nie nakłada się czysto.

**Hoisting `vi.mock`.** Fabryka `vi.mock` jest podnoszona ponad importy, więc nie może domykać się
nad zmienną z `const` na poziomie modułu — atrapa `createClient` musi powstać przez `vi.hoisted`.
Trasa jest ładowana przez `await import(...)` w ciele testu, nie statycznym importem, żeby atrapa
klienta była skonfigurowana **przed** ewaluacją modułu.

## Faza 1: Osprzęt i pierwszy przypadek wiążący

### Przegląd

Powstają trzy atrapy i jedna asercja, która niesie cały Guardrail. Skrypt sondy dowodzi, że ta
asercja czerwieni na wariancie rozbrajającym — bez tego dowodu faza nie ma wartości.

### Wymagane zmiany

#### 1. Osprzęt testowy toru zapisu

**Plik**: `src/lib/team-save-route.test.ts` (nowy)

**Cel**: Postawić atrapy, na których wykonuje się prawdziwa trasa API w Node, i związać pierwszym
przypadkiem najostrzejszą postać Guardraila: skład poniżej progu nie zostawia zapisu.

**Kontrakt**: Trzy byty, wszystkie lokalne dla pliku testowego.

1. **Atrapa `@/lib/supabase`** — `createClient` przez `vi.hoisted(() => vi.fn())`, podmieniana
   `vi.mock("@/lib/supabase", () => ({ createClient: <atrapa> }))`. Prawdziwy moduł nigdy się nie
   ewaluuje, więc `astro:env/server` nie jest rozwiązywany — to jest ścieżka **zgodna** z twardą
   regułą `AGENTS.md`, nie wyjątek od niej.

2. **Atrapa klienta Supabase** — funkcja fabrykująca, zwracająca obiekt z `from(table)` oraz
   publicznym dziennikiem zapisów. Zna dokładnie dwa kształty:
   - `from("characters")` → thenable builder wspierający `.select()`, `.order()` (dwukrotnie),
     rozwiązujący się do `{ data: <wiersze puli>, error: null }`;
   - `from("teams")` → `.insert(row)` i `.update(row)`, **każde dopisuje wpis do dziennika**,
     zwraca builder odtwarzający łańcuchy repo **co do kolejności**:
     `.insert().select().single()` ([team-repo.ts:88-91](src/lib/team-repo.ts#L88-L91)) oraz
     `.update().eq().select().maybeSingle()` ([team-repo.ts:127-131](src/lib/team-repo.ts#L127-L131)),
     oba oddające `{ data: { id, name }, error: null }` w kształcie `SUMMARY_SELECT`.

   Każda inna tabela i każda nieznana metoda **rzucają**. To jest różnica między atrapą a dziurą:
   atrapa przepuszczająca dowolne zapytanie cicho rozjeżdża się z prawdziwą bazą, przed czym
   `test-plan.md` §2 ostrzega przy #1 i #6 osobnym zdaniem.

3. **Atrapa `APIContext`** — obiekt z `locals.user`, `request` (prawdziwy `Request` z ciałem
   `URLSearchParams`, żeby `formData()` był prawdziwym `formData()`), `cookies`, `params`
   i `redirect(path)` zwracającym `new Response(null, { status: 302, headers: { Location: path } })`.
   Sonda potwierdziła, że handler nie sięga po nic ponadto.

4. **Fixtura puli** — `CHARACTER_POOL` → `CharacterRow[]` z `sort_order` z indeksu. Pula w teście
   pochodzi ze stałej domeny, nie z literałów, więc dopisanie postaci nie wywraca testu w ciszy.

   Pierwszy przypadek: żądanie z ciałem `composition=[]` do `POST /api/teams` → dziennik zapisów
   jest **pusty**, a odpowiedź to 302 na `/teams/new?error=…`.

#### 2. Skrypt sondy rozbrajającej

**Pliki**: `scripts/probe-save-barrier.sh` i `scripts/probe-save-barrier.patch` (oba nowe)

**Cel**: Dowieść — powtarzalnie i dosłownie uruchamialnie — że test toru czerwieni się, gdy trasa
przestaje wołać bramkę przed zapisem. Pięć wpisów w `lessons.md` opisuje awarię „komenda założona,
nie uruchomiona"; skrypt w repozytorium czyni uruchomienie tańszym niż założenie.

**Kontrakt**: Bash, `set -euo pipefail`, bez argumentów, uruchamiany z korzenia repozytorium.
Odmawia startu, gdy `git status --porcelain src/pages/api/teams/` nie jest puste. Instaluje `trap`
wołający `git apply -R scripts/probe-save-barrier.patch` na `EXIT`, `INT` i `TERM` **przed**
pierwszą modyfikacją. Nakłada łatkę przez `git apply scripts/probe-save-barrier.patch` (nieczyste
nałożenie → wyjście niezerowe z komunikatem, że łatka rozjechała się z `index.ts`), uruchamia
`npm test`, i:

- kod wyjścia `0` (testy zielone na rozbrojonej barierze) → skrypt kończy się **niezerowo**
  z komunikatem, że strażnik nie wiąże;
- kod wyjścia niezerowy → skrypt kończy się `0` z potwierdzeniem, które nazwy testów padły.

Odwrócenie kodu wyjścia jest istotą skryptu i musi być opisane komentarzem w nagłówku, inaczej
przyszły czytelnik uzna zieloną sondę za awarię.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm test` zielone i liczba plików rośnie z 17 na 18: `npm test 2>&1 | grep -E "Test Files.*18 passed"`
- Nowy plik testowy nie mieszka w `src/pages/`: `test ! -e src/pages/api/teams/index.test.ts && ls src/lib/team-save-route.test.ts`
- Test faktycznie ładuje trasę, a nie jej kopię — kotwica na wywołaniu, nie na deklaracji, i obejmuje
  wariant dynamiczny (`lessons.md` §„Strażnik grepowy nad JSX/TS"):
  `grep -nE 'import\(\s*"@/pages/api/teams' src/lib/team-save-route.test.ts`
- Osprzęt jest nowy wobec bazy sondy — kryterium czerwieni się na `a392c62`
  (`lessons.md` §„Strażnik, który jest zielony na commicie bazowym"):
  `! git show a392c62:src/lib/team-save-route.test.ts 2>/dev/null`
- `vitest.config.ts` i `.github/workflows/ci.yml` nietknięte wobec bazy sondy — komenda musi mieć
  kod wyjścia, nie tylko wypisać różnicę:
  `git diff --quiet a392c62 -- vitest.config.ts .github/workflows/ci.yml`
- Skrypt sondy jest wykonywalny, ma `trap` przed modyfikacją, a mutacja jest łatką w repo:
  `test -x scripts/probe-save-barrier.sh && grep -nE '^\s*trap\s' scripts/probe-save-barrier.sh`
  oraz `git apply --check scripts/probe-save-barrier.patch`
- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Weryfikacja ręczna

- `scripts/probe-save-barrier.sh` uruchomiony **dosłownie** kończy się kodem `0` i wypisuje nazwę
  co najmniej jednego testu, który padł na mutacji — to jest **pierwsze** sondowanie wariantu
  kanonicznego; do tej chwili jego czerwień jest założeniem, nie faktem
- Po przebiegu sondy `git status --porcelain src/pages/api/teams/` jest puste — `trap` cofnął łatkę.
  (Zakres na katalog trasy, nie na całe drzewo: w trakcie fazy `plan.md` niesie odhaczony Progress,
  a plik testowy jest nowy, więc gołe `git status --porcelain` padłoby przy poprawnym przebiegu.)
- Sonda przerwana `Ctrl-C` w trakcie `npm test` również zostawia `src/pages/api/teams/` czyste
- Atrapa klienta rzuca przy zapytaniu o nieznaną tabelę — sprawdzone doraźną zmianą tabeli
  w wywołaniu repo, cofniętą po sprawdzeniu

**Uwaga implementacyjna**: Po zakończeniu tej fazy i wszystkich automatycznych testów
weryfikacyjnych, zatrzymaj się tutaj, aby uzyskać ręczne potwierdzenie od człowieka, że testy
ręczne zakończyły się sukcesem, zanim przejdziesz do następnej fazy.

---

## Faza 2: Komplet ryzyk #1 i #6 na obu trasach zapisu

### Przegląd

Na przesondowanym osprzęcie dokładają się przypadki: próg i sześć limitów, każdy przeciwko obu
pisarzom składu, plus kontrakt odmowy. Osprzęt się nie zmienia.

### Wymagane zmiany

#### 1. Przypadki ryzyka #1 — próg

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać Guardrail „zapisana drużyna zawsze spełnia próg" dla obu kierunków zapisu, w obie
strony werdyktu.

**Kontrakt**: Dla `POST /api/teams` i `POST /api/teams/[id]`, symetrycznie:
skład pusty, skład sześciu postaci bez perków (nigdy nie domyka progu — sześć specjalizacji na
siedem kompetencji, PRD → Business Logic), oraz skład z solvera `findThresholdSolution(CHARACTER_POOL)`
jako przypadek pozytywny. Odmowa → dziennik zapisów pusty; przyjęcie → dokładnie **jeden** wpis,
niosący skład po parserze.

#### 2. Przypadki ryzyka #6 — sześć limitów

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać Guardrail „limity składu nie do obejścia" na torze zapisu, dla każdego z limitów
osobno — żądanie idzie z pominięciem interfejsu, więc blokada przycisku niczego tu nie chroni.

**Kontrakt**: **Sześć** naruszeń — tyle, ile wariantów ma `RuleViolation`
([evaluate-team.ts:15-21](src/lib/domain/evaluate-team.ts#L15-L21)); wcześniejsze „pięć limitów"
w tym planie było błędem liczenia, biorącym `unknown-character` i `unknown-perk` za jedną pozycję.
Każde budowane przez **doklejenie na siłę** do składu z solvera, żeby przypadek izolował jeden
limit: `too-many-members` (siódmy członek), `duplicate-character` (powtórzona postać),
`too-many-perks` (trzeci perk), `duplicate-perk` (ten sam perk dwukrotnie), `unknown-character`
(identyfikator postaci spoza puli), `unknown-perk` (perk nienależący do postaci). Każdy → dziennik
zapisów pusty, na obu trasach.

Przypadki idą **tabelą** (`it.each` po sześciu naruszeniach × dwie trasy), a kardynalność wiąże
asercja nad tabelą — `expect(VIOLATION_CASES).toHaveLength(6)` i `expect(SAVE_ROUTES).toHaveLength(2)`
— nie licznik testów ani `grep -c`. `lessons.md` §„Strażnik musi mierzyć to, co deklaruje": próg
liczbowy nad wyjściem `grep`/vitest wiąże linie, nie byty.

Asercja brzmi „zero zapisów", **nigdy** „`scores` wynosi N": `scores` odzwierciedla surowy wybór,
więc trzeci perk i powtórzona postać podnoszą punkty mimo naruszenia.

#### 3. Kontrakt odmowy

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać twardą regułę `AGENTS.md` „odmowa to redirect z `?error=`, nie JSON", której dziś
nie pilnuje nic, oraz cele redirectów, które różnią się między trasami.

**Kontrakt**: Każda odmowa ma `status === 302`; nagłówek `Location` zaczyna się od `/teams/new?error=`
(create) albo `/teams/<id>?error=` (update); sukces prowadzi na `/teams/<id>/embark` (create) i
`/teams/<id>?saved=1` (update). Ciało odpowiedzi jest puste, `Content-Type` nie jest JSON-em.
Mapowanie `reason.kind` → komunikat: nie-JSON daje `INVALID_PAYLOAD_MESSAGE`, skład poniżej progu
i **każde** naruszenie limitu dają `BELOW_THRESHOLD_MESSAGE` — stałe importowane z
`@/lib/team-submission`, nie przepisane, bo druga kopia tekstu rozjechałaby się z regułą.

**Granica tej reguły.** Eksportowane są **dokładnie dwie** stałe komunikatów
([team-submission.ts:40,43](src/lib/team-submission.ts#L40-L43)). Pozostałe teksty odmowy —
`SAVE_FAILED_MESSAGE` ([\[id\].ts:31](src/pages/api/teams/[id].ts#L31), prywatna stała modułu),
`"Supabase is not configured"` i `"Character pool is unavailable"` (literały w ciele obu tras) —
**nie są i nie będą importowalne w tej fazie**, bo zakres zabrania zmian w `src/pages/`. Test
asercjonuje je jako **świadomą drugą kopię literału**, nazwaną tu wprost, żeby `/10x-impl-review`
nie zgłosił jej jako dryfu. Wyniesienie ich do `@/lib/team-submission` jest kandydatem na osobną
zmianę, nie na tę fazę.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm test` zielone. Kardynalność jest związana **wewnątrz** testu — `expect(VIOLATION_CASES).toHaveLength(6)`
  i `expect(SAVE_ROUTES).toHaveLength(2)` padają, gdy któryś rodzaj naruszenia albo która trasa
  wypadnie z tabeli. Kryterium liczące testy w wyjściu `vitest` zostało **skreślone**: liczyło linie
  i wymagało arytmetyki człowieka, a asercja nad tabelą wiąże to samo mocniej
  (`lessons.md` §„Strażnik musi mierzyć to, co deklaruje" — licznik dublujący asercję się kreśli).
  Z tego samego powodu skreślony jest `grep -c` po dynamicznych importach: `-c` liczy linie, więc
  dwa importy `index` domykały próg bez ani jednego załadowania `[id]`; obie trasy wiąże asercja
  tabeli i ręczne 2.7.
- Komunikaty odmowy z `@/lib/team-submission` są importowane, nie przepisane:
  `grep -nE '^import .*(BELOW_THRESHOLD_MESSAGE|INVALID_PAYLOAD_MESSAGE)' src/lib/team-save-route.test.ts`
  oraz brak literału: `! grep -n 'Every competency needs at least' src/lib/team-save-route.test.ts`.
  Kryterium dotyczy **wyłącznie** tych dwóch stałych — trzy pozostałe teksty odmowy nie są
  eksportowane (patrz pkt 3) i wolno im być literałami.
- Wyrocznia nie pochodzi ze `scores`: `! grep -nE '\.scores\b' src/lib/team-save-route.test.ts`
- `npm run lint` przechodzi
- `npx astro check` przechodzi

#### Weryfikacja ręczna

- `scripts/probe-save-barrier.sh` nadal kończy się `0`, a lista testów, które padły, jest teraz
  **dłuższa** niż po Fazie 1
- Ta sama mutacja zastosowana ręcznie do `src/pages/api/teams/[id].ts` również daje czerwień —
  potwierdza, że trasa edycji jest związana niezależnie, a nie „przy okazji"
- Przegląd przypadków pod kątem lustra implementacji: każda oczekiwana wartość daje się wskazać
  w PRD (Guardrails, FR-012, FR-014, FR-018) albo w stałych `src/lib/domain/types.ts`
- Wszystkie **sześć** rodzajów naruszeń ma własny przypadek na **obu** trasach — sprawdzone
  przeglądem listy testów, nie grepem: kryterium grepowe po nazwach testów kotwiczyłoby się na
  słowach w prozie, czyli dokładnie na klasie, którą `lessons.md` opisuje pięciokrotnie. Przegląd
  potwierdza też, że tabela faktycznie ładuje **obie** trasy, a nie dwa razy `index`

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie
przed przejściem do następnej.

---

## Faza 3: Glue trasy — siedem kroków domkniętych

### Przegląd

Pozostałe kroki sekwencji, w tym te chroniące Worker przed 500. Osprzęt stoi, więc każdy przypadek
to kilka linii.

### Wymagane zmiany

#### 1. Gałęzie wejściowe sekwencji

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać cztery kroki, które dziś nie mają asercji, a bronią przed nieprzechwyconym
`throw` w Workerze — kroki 1–5 sekwencji z obu tras.

**Kontrakt**: Brak `locals.user` → 302 na `/auth/signin`, **bez** dotknięcia klienta.
`createClient` zwracające `null` → odmowa z komunikatem konfiguracji, zero zapytań.
Ciało o `Content-Type: application/json` → `formData()` rzuca, handler oddaje `INVALID_PAYLOAD_MESSAGE`
zamiast propagować `TypeError`. Brak pola `composition` w formularzu → ta sama odmowa.
`getCharacterPool` rzucające → odmowa „Character pool is unavailable", zero zapisów.
W każdej z tych gałęzi dziennik zapisów pozostaje pusty.

Teksty „Supabase is not configured" i „Character pool is unavailable" są literałami w ciele obu tras,
więc w teście też są literałami — świadoma druga kopia, uzasadniona w Fazie 2 pkt 3.

Nazwa pola pochodzi ze stałej `COMPOSITION_FIELD`, nie z literału `"composition"` — jedna kopia
kontraktu, dzielona z wyspą.

#### 2. Kodowanie identyfikatora w trasie edycji

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać `encodeURIComponent(params.id)` z [`[id].ts:40`](src/pages/api/teams/[id].ts#L40) —
funkcja czysta, nietrywialna i broniąca przed 500: Astro dekoduje ścieżkę przed dopasowaniem trasy,
więc `params.id === "\n"` bez kodowania wywraca `new Response` surową nową linią w `Location`.

**Kontrakt**: `params.id` zawierające znak nowej linii daje odpowiedź 302 z nagłówkiem `Location`,
który **nie** zawiera surowego `\n` i który `new Response` przyjmuje bez rzucania. Dla poprawnego
UUID kodowanie jest identycznością — cel redirectu jest znakowo równy wariantowi niekodowanemu.

#### 3. Brak wiersza do aktualizacji

**Plik**: `src/lib/team-save-route.test.ts`

**Cel**: Związać gałąź `team === null` z [`[id].ts:90-97`](src/pages/api/teams/[id].ts#L90-L97) —
zero zmienionych wierszy nie jest awarią zapytania, tylko stanem, w którym RLS ukrywa cudzy wiersz.
Gałąź niesie własność US-04: odpowiedź nie może się różnić od „nieznane id".

**Kontrakt**: Dwa rozłączne przypadki — poprzednie sformułowanie („nie-UUID daje odpowiedź znakowo
równą") było **niespełnialne**: `reject()` wkleja identyfikator do ścieżki
([\[id\].ts:40,47](src/pages/api/teams/[id].ts#L40-L47)), więc `Location` dla `"abc"` i dla UUID-a
nigdy nie będzie ten sam.

1. **Znakowa równość tam, gdzie broni US-04** — dwa **poprawne** UUID-y: własny wiersz, którego nie
   ma, i cudzy odcięty przez RLS. Oba wracają z repo jako `null` bez `error`
   ([team-repo.ts:118-131](src/lib/team-repo.ts#L118-L131)), więc komponent `?error=` musi być
   znakowo równy — różnica ujawniałaby istnienie cudzego rekordu.
2. **Nie-UUID w `params.id`** — `updateTeam` odcina go przez `isTeamId` **przed** zapytaniem
   ([team-repo.ts:74,121-123](src/lib/team-repo.ts#L74)), więc: ten sam komunikat odmowy, dziennik
   zapisów pusty, **zero wywołań** atrapy klienta na `teams` i żaden `throw`.

Komunikat w obu przypadkach to literał `SAVE_FAILED_MESSAGE` przepisany do testu — stała jest
prywatna dla `[id].ts` i zakres fazy nie pozwala jej wyeksportować (patrz Faza 2 pkt 3).

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm test` zielone
- Nazwa pola pochodzi ze stałej, nie z literału:
  `grep -nE '^import .*COMPOSITION_FIELD' src/lib/team-save-route.test.ts`
- Gałąź braku sesji jest pod testem i celuje w cel redirectu, tolerując końcowy ukośnik
  (`lessons.md` §„Strażnik grepowy nad JSX/TS"): `grep -nE '/auth/signin/?"' src/lib/team-save-route.test.ts`
- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run build` przechodzi

#### Weryfikacja ręczna

- `scripts/probe-save-barrier.sh` nadal kończy się `0`
- Ręczna mutacja „usuń `try/catch` wokół `formData()`" daje czerwień, a nie 500 wypuszczony
  z handlera — potwierdza, że gałąź jest związana skutkiem, nie kształtem kodu
- Ręczna mutacja „zdejmij `encodeURIComponent` z `[id].ts:40`" daje czerwień
- Każdy z siedmiu kroków sekwencji (sesja, klient, `formData()`, pole, pula, bramka, repo) ma
  nazwany przypadek — sprawdzone przeglądem listy testów, nie grepem po nazwach w prozie

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie
przed przejściem do następnej.

---

## Faza 4: Książka kucharska i domknięcie bramek

### Przegląd

Faza zamienia jednorazową robotę w wzorzec, z którego korzystają Fazy 2–4 wdrożenia. Nic tu nie
zmienia kodu.

### Wymagane zmiany

#### 1. Wzorzec testu toru zapisu w książce kucharskiej

**Plik**: `context/foundation/test-plan.md`

**Cel**: Zastąpić `TBD — see §3 Phase 1` w §6.2 kanoniczną odpowiedzią na „jak dodać test toru
zapisu w tym projekcie" — to jest artefakt, dla którego faza w ogóle powstała.

**Kontrakt**: §6.2 dostaje pięć pozycji w kształcie §6.1: **Lokalizacja** (`src/lib/`, ze
świadomym wyjątkiem od konwencji „obok modułu" i jego powodem — `.ts` w `src/pages/` staje się
endpointem), **Nazewnictwo** (`<obszar>-route.test.ts`), **Czystość** (`vi.hoisted` + `vi.mock`
na `@/lib/supabase`, atrapa klienta jako argument, prawdziwy klient nigdy), **Test referencyjny**
(`src/lib/team-save-route.test.ts`), **Uruchomienie** (`npm test`), plus szósta pozycja
**Kontrola mutacyjna** wskazująca `scripts/probe-save-barrier.sh` i nazywająca kanoniczną mutację.

#### 2. Stempel stanu wdrożenia

**Plik**: `context/foundation/test-plan.md`

**Cel**: Przesunąć orkiestrator na Fazę 2 i podnieść bramkę, która czekała na tę fazę.

**Kontrakt**: §3, wiersz 1 — Status **→ `complete`**, niezależnie od tego, co stoi tam w chwili
rozpoczęcia fazy (orkiestrator przesuwa ten wiersz `researched` → `planned` → `implementing`
sam; na dzień pisania planu czyta `planned`). §5, wiersz „integration na torze zapisu" —
`required after §3 Phase 1` → `required (wired)`. §4, wiersz „integration (trasy, baza)" —
`none yet — see Phase 1 i Phase 2` → Vitest z odsyłaczem do wzorca §6.2. §6.7 dostaje 2–3 linie
o tym, czego faza nauczyła, w tym znany dług: brak przypadków `duplicate-character` i `unknown-perk`
w `src/lib/team-submission.test.ts`, świadomie zostawiony poza zakresem.

#### 3. Tożsamość zmiany

**Plik**: `context/changes/2026-09-07-testing-save-barrier/change.md`

**Cel**: Domknąć folder zmiany.

**Kontrakt**: `status: complete`, `updated: <data zakończenia>`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- §6.2 nie jest już placeholderem:
  `! grep -n 'TBD — see §3 Phase 1' context/foundation/test-plan.md`
- §6.2 wskazuje test referencyjny i skrypt sondy:
  `grep -n 'team-save-route.test.ts' context/foundation/test-plan.md` oraz
  `grep -n 'probe-save-barrier.sh' context/foundation/test-plan.md`
- Bramka podniesiona: `! grep -n 'required after §3 Phase 1' context/foundation/test-plan.md`
- Wiersz §4 przestał brzmieć `none yet`:
  `! grep -n 'none yet — see Phase 1' context/foundation/test-plan.md`
- Folder zmiany domknięty: `grep -n '^status: complete' context/changes/2026-09-07-testing-save-barrier/change.md`
- §1 i §7 przewodnika nietknięte wobec **jawnego SHA bazy sondy**, nie `HEAD`
  (`lessons.md` §„Linię bazową strażnika kotwicz na jawnym SHA"):
  `diff <(git show a392c62:context/foundation/test-plan.md | sed -n '/^## 1\./,/^## 2\./p') <(sed -n '/^## 1\./,/^## 2\./p' context/foundation/test-plan.md)` daje pustą różnicę; to samo dla `## 7.` → `## 8.`
- `npm test`, `npm run lint`, `npm run build` przechodzą

#### Weryfikacja ręczna

- §6.2 przeczytany przez pryzmat pytania „czy ktoś, kto nie brał udziału w tej fazie, dopisze
  test toru zapisu wyłącznie na jego podstawie" — jeśli nie, pozycja jest niepełna
- §6.7 nazywa dług `duplicate-character` / `unknown-perk` wprost, więc nie zginie
- Kryteria porównujące §1 i §7 z bazą **czerwienią się na naruszeniu** — potwierdzone doraźną edycją
  każdej z sekcji i cofnięciem (to jest weryfikacja ręczna, nie automatyczna: wymaga edycji,
  uruchomienia i cofnięcia)
- `scripts/probe-save-barrier.sh` uruchomiony po raz ostatni: kończy się `0`,
  `git status --porcelain src/pages/api/teams/` puste

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie.

---

## Strategia testowania

Ta faza **jest** strategią testowania, więc sekcja opisuje, co wiąże sam osprzęt.

### Testy jednostkowe

Bez zmian — 17 istniejących plików zostaje nietkniętych. Faza niczego w nich nie poprawia ani nie
przenosi; rozdział „reguła jest testowana jednostkowo, tor wykonawczo" jest celowy.

### Testy integracyjne

`src/lib/team-save-route.test.ts` wykonuje `POST /api/teams` i `POST /api/teams/[id]` w Node,
na atrapie klienta i atrapie `APIContext`. Scenariusze end-to-end w granicach Workera:
próg (ryzyko #1), sześć limitów (ryzyko #6), kontrakt odmowy, siedem kroków glue.

### Kontrola mutacyjna

Warunek konieczny, nie dodatek: `scripts/probe-save-barrier.sh` nakłada
`scripts/probe-save-barrier.patch` (zapis przed odmową) i wymaga czerwieni. Uruchamiany w każdej
z czterech faz — lista testów, które padają, ma rosnąć. Zielona sonda oznacza, że osprzęt jest
dekoracją, i blokuje odhaczenie fazy. Uwaga: sam wariant kanoniczny jest **nieprzesondowany** do
chwili pierwszego przebiegu w Fazie 1.

### Kroki testowania ręcznego

1. `scripts/probe-save-barrier.sh` — dosłownie, bez argumentów; oczekiwany kod wyjścia `0`
2. `git status --porcelain src/pages/api/teams/` po sondzie — musi być puste
3. Sonda przerwana `Ctrl-C` w trakcie `npm test` — `src/pages/api/teams/` nadal czyste
4. Mutacja na `[id].ts` (zapis przez `updateTeam` przed odmową) — oczekiwana czerwień
5. Mutacja „zdejmij `encodeURIComponent`" w `[id].ts:40` — oczekiwana czerwień
6. Przegląd asercji pod kątem lustra implementacji: każda oczekiwana wartość wskazywalna w PRD
   albo w `src/lib/domain/types.ts`

## Uwagi dotyczące wydajności

Cała sekwencja trasy wykonuje się w pamięci — sonda zmierzyła ~70 ms na dwa przypadki, wobec 548 ms
całego `npm test`. Faza nie zbliża `npm test` do żadnej granicy odczuwalności i nie uzasadnia
przegród w `vitest.config.ts`.

## Uwagi dotyczące migracji

Brak. Faza nie dotyka bazy, schematu ani konfiguracji builda. Jedyne artefakty poza `src/` to
`scripts/probe-save-barrier.sh` i `scripts/probe-save-barrier.patch`, których nie woła żaden skrypt
npm ani CI.

## Referencje

- **Baza sondy (jawny SHA)**: `a392c62` — cytowana w kryteriach każdej fazy; nigdy `HEAD`
- Badanie: `context/changes/2026-09-07-testing-save-barrier/research.md`
- Umowa jakościowa: `context/foundation/test-plan.md` §2 (ryzyka #1, #6), §3 (Faza 1), §4 (stos,
  litera czystości testów), §5 (bramki), §6.2 (miejsce docelowe wzorca)
- Rejestr lekcji: `context/foundation/lessons.md` — §„Strażnik, który jest zielony na commicie
  bazowym", §„Strażnik musi mierzyć to, co deklaruje", §„Linię bazową strażnika kotwicz na jawnym SHA",
  §„Strażnik grepowy nad JSX/TS"
- Bramka pod testem: [team-submission.ts:133-145](src/lib/team-submission.ts#L133-L145)
- Reguła i limity: [evaluate-team.ts:55-129](src/lib/domain/evaluate-team.ts#L55-L129)
- Tory zapisu: [api/teams/index.ts:29-79](src/pages/api/teams/index.ts#L29-L79),
  [api/teams/[id].ts:33-104](src/pages/api/teams/[id].ts#L33-L104)
- Wzorzec „klient jako argument": `context/archive/2026-08-30-solvable-character-pool/plan.md:69-71`
- Źródło reguły czystości testów: `context/archive/2026-08-30-domain-rule-verification-harness/plan.md:46-51`
- Teza, którą ta faza obala: `context/archive/2026-09-06-cross-account-team-isolation/plan.md:56-58`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw kroków. Zobacz `references/progress-format.md`.

### Faza 1: Osprzęt i pierwszy przypadek wiążący

#### Automatyczne

- [x] 1.1 `npm test` zielone, 18 plików testowych
- [x] 1.2 Plik testowy w `src/lib/`, nie w `src/pages/`
- [x] 1.3 Test ładuje trasę dynamicznym importem (kotwica na wywołaniu)
- [x] 1.4 Osprzęt czerwieni się na bazie sondy `a392c62` (plik tam nie istnieje)
- [x] 1.5 `vitest.config.ts` i `ci.yml` nietknięte wobec `a392c62` (`git diff --quiet`)
- [x] 1.6 Skrypt sondy wykonywalny, `trap` przed modyfikacją, łatka nakłada się (`git apply --check`)
- [x] 1.7 `npm run lint` przechodzi
- [x] 1.8 `npx astro check` przechodzi

#### Ręczne

- [x] 1.9 Sonda uruchomiona dosłownie kończy się `0` i nazywa testy, które padły — pierwsze sondowanie wariantu kanonicznego
- [x] 1.10 `git status --porcelain src/pages/api/teams/` puste po przebiegu sondy
- [x] 1.11 Sonda przerwana `Ctrl-C` zostawia `src/pages/api/teams/` czyste
- [x] 1.12 Atrapa klienta rzuca przy nieznanej tabeli

### Faza 2: Komplet ryzyk #1 i #6 na obu trasach zapisu

#### Automatyczne

- [ ] 2.1 `npm test` zielone; tabela wiąże kardynalność asercją (`VIOLATION_CASES` = 6, `SAVE_ROUTES` = 2)
- [ ] 2.2 Dwie eksportowane stałe komunikatów importowane, zero literału progu
- [ ] 2.3 Wyrocznia nie pochodzi ze `scores`
- [ ] 2.4 `npm run lint` przechodzi
- [ ] 2.5 `npx astro check` przechodzi

#### Ręczne

- [ ] 2.6 Sonda kończy się `0`, lista padających testów dłuższa niż po Fazie 1
- [ ] 2.7 Mutacja na `[id].ts` daje niezależną czerwień
- [ ] 2.8 Przegląd pod kątem lustra implementacji — każda wartość wskazywalna w PRD
- [ ] 2.9 Sześć rodzajów naruszeń ma własny przypadek na obu trasach — przegląd listy testów

### Faza 3: Glue trasy — siedem kroków domkniętych

#### Automatyczne

- [ ] 3.1 `npm test` zielone
- [ ] 3.2 Nazwa pola pochodzi ze stałej `COMPOSITION_FIELD`
- [ ] 3.3 Gałąź braku sesji pod testem, wzorzec toleruje końcowy ukośnik
- [ ] 3.4 `npm run lint` przechodzi
- [ ] 3.5 `npx astro check` przechodzi
- [ ] 3.6 `npm run build` przechodzi

#### Ręczne

- [ ] 3.7 Sonda kończy się `0`
- [ ] 3.8 Mutacja „usuń `try/catch` wokół `formData()`" daje czerwień
- [ ] 3.9 Mutacja „zdejmij `encodeURIComponent`" daje czerwień
- [ ] 3.10 Każdy z siedmiu kroków sekwencji ma nazwany przypadek — przegląd listy testów

### Faza 4: Książka kucharska i domknięcie bramek

#### Automatyczne

- [ ] 4.1 §6.2 nie jest już placeholderem
- [ ] 4.2 §6.2 wskazuje test referencyjny i skrypt sondy
- [ ] 4.3 Bramka integracyjna podniesiona na `required (wired)`
- [ ] 4.4 Wiersz §4 „integration (trasy, baza)" nie brzmi już `none yet`
- [ ] 4.5 `change.md` ma `status: complete`
- [ ] 4.6 §1 i §7 przewodnika nietknięte wobec `a392c62`
- [ ] 4.7 `npm test`, `npm run lint`, `npm run build` przechodzą

#### Ręczne

- [ ] 4.8 §6.2 wystarcza obcemu do dopisania testu toru zapisu
- [ ] 4.9 §6.7 nazywa dług `duplicate-character` / `unknown-perk` wprost
- [ ] 4.10 Kryteria porównujące §1 i §7 z bazą czerwienią się na naruszeniu
- [ ] 4.11 Sonda uruchomiona po raz ostatni: `0`, `src/pages/api/teams/` czyste
