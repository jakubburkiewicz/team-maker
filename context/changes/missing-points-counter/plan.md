# Plan implementacji: Licznik brakujących punktów (S-08)

## Przegląd

Wyrenderować `evaluation.missing` — jedyną wartość zwracaną przez `evaluateTeam`, której żaden
komponent nie czyta — jako listę kompetencji poniżej progu wraz z liczbą brakujących punktów,
obok wykresu pajęczynowego (FR-017, `## Success Criteria` → Secondary).

Fragment jest czysto prezentacyjny: reguła domenowa, jej testy i umowa odczytu istnieją od F-01
i nie zmieniają się ani o linijkę. Powstaje jeden czysty helper z testem, jeden komponent
prezentacyjny i jedna przebudowa gałęzi warunkowej w istniejącej wyspie.

## Analiza stanu obecnego

- **Braki są policzone i przetestowane.** `evaluateTeam` zwraca
  `missing: Record<Competency, number>` — „punkty brakujące do progu w każdej kompetencji;
  0 gdy domknięta" (`src/lib/domain/evaluate-team.ts:36`, obliczenie `:109-119`). Asercje stoją
  w `src/lib/domain/evaluate-team.test.ts:49` (pusty skład → 2 w każdej), `:65` (0 przy nadmiarze),
  `:72` (skład domykający), `:82` (jeden punkt za krótki → dokładnie `missing.navigation === 1`).
- **Nikt tej wartości nie czyta.** Jedyne wystąpienia `missing` poza plikami testowymi są wewnątrz
  `evaluate-team.ts`. `TeamComposer.tsx:57` liczy `evaluation` i przekazuje dalej wyłącznie
  `scores` (do wykresu) i `isValid` (do bramki).
- **Miejsce zostało zarezerwowane w S-02.** Prawa kolumna wyspy to
  `<aside className="flex flex-col gap-4">` z nagłówkiem „Competencies", wykresem i bramką
  (`src/components/team/TeamComposer.tsx:120-133`). Brief S-02 zapisał decyzję układu słowami
  „S-08 ma gdzie dodać licznik »obok wykresu«", a `plan.md:106` tego samego fragmentu —
  „`evaluation.missing` jest liczone, ale nie renderowane".
- **Istnieje wiążąca umowa odczytu, wymieniająca S-08 imiennie.** JSDoc `TeamEvaluation.scores`
  (`evaluate-team.ts:24-33`): sumy odzwierciedlają surowy wybór gracza, także odrzucony przez
  limity, więc „konsument rysujący wykres (S-02) lub licznik braków (S-08) czyta te sumy wyłącznie
  przy pustym `violations`". `TeamComposer.tsx:127` egzekwuje to dziś **jednym** warunkiem
  `evaluation.violations.length === 0` z gałęzią awaryjną `:130`.
- **Jedna wyspa obsługuje oba ekrany.** Po S-05 trybu odczytu nie ma: `/teams/new`
  (`src/pages/teams/new.astro:49`) i `/teams/[id]` (`src/pages/teams/[id].astro:132`) renderują
  `TeamComposer` z `client:load`, różniąc się wyłącznie obecnością `teamId`. `/teams/[id]/embark`
  i `/teams` wyspy nie renderują.
- **FR-018 jest celowo niezależny od FR-017.** Komunikat pod przyciskiem to statyczny
  `BELOW_THRESHOLD_MESSAGE` (`src/components/team/CompositionGate.tsx:68`, stała
  w `src/lib/team-submission.ts:40`, wspólna z obiema trasami zapisu). PRD osłabiło FR-018 do
  komunikatu ogólnego właśnie po to, żeby zapis nie zależał od tego fragmentu.
- **Testy są czyste i mają twardą konwencję.** `vitest.config.ts` obejmuje `src/**/*.test.ts`, bez
  jsdom i bez testów komponentów React. Asercje używają **literałów z PRD**, nigdy przypiętych
  stałych — zapisane wprost w `evaluate-team.test.ts:16-17`, `roster.test.ts:16-18`,
  `character-pool.test.ts:8-11`, `team-submission.test.ts:23-25`. Precedens dla logiki
  prezentacyjnej: `src/lib/radar-geometry.ts` + `radar-geometry.test.ts` z S-02.
- **Konwencja tekstów interfejsu.** Wszystkie napisy po angielsku; nazwa kompetencji renderowana
  jako `text-xs tracking-wide uppercase` w kolorze `text-purple-300`, wartość punktowa obok
  w `text-blue-100/60` (`src/components/team/RosterSlot.tsx:69-72, 84-88`). Etykieta sekcji:
  `text-xs font-semibold text-blue-100/80` (`RosterSlot.tsx:77`).

## Pożądany stan końcowy

W prawej kolumnie obu ekranów kompletowania, między wykresem a przyciskiem, stoi lista
kompetencji poniżej progu — każda z liczbą brakujących punktów, w tej samej kolejności co osie
wykresu. Pusty skład pokazuje siedem wierszy po „2 points short"; każde dodanie postaci lub perka
skraca listę natychmiast; domknięcie progu usuwa ją w całości, zostawiając zielony komunikat
bramki. Zdjęcie perka przywraca ją z jednym wierszem. Komunikat FR-018 pod przyciskiem nie
zmienia się ani o znak.

Weryfikacja: `npm test` dowodzi wyboru i kolejności wierszy poza przeglądarką; pełny łańcuch CI
(`astro sync` → `lint` → `test` → `build`) przechodzi; `git diff` wobec `f11ba86` pokazuje zero
zmian w `src/lib/domain/`, `CompetencyRadar.tsx`, `CompositionGate.tsx`, obu stronach
i `package.json`.

### Kluczowe odkrycia:

- `src/lib/domain/evaluate-team.ts:36` — `missing` istnieje, jest udokumentowane i przetestowane;
  domena nie wymaga żadnej zmiany.
- `src/lib/domain/evaluate-team.ts:24-33` — umowa „czytaj tylko przy pustym `violations`" wymienia
  ten fragment po nazwie. To ona dyktuje kształt Fazy 2.
- `src/components/team/TeamComposer.tsx:127-131` — istniejąca gałąź warunkowa i jej komunikat
  awaryjny; jedyne miejsce, w którym umowa jest dziś egzekwowana.
- `src/components/team/CompetencyRadar.tsx:21` — `radarLayout(COMPETENCIES, …)`, więc kolejność
  osi wykresu **jest** kolejnością `COMPETENCIES`. Helper czytający tę samą stałą nie może się
  z nią rozjechać.
- `src/lib/radar-geometry.ts` + `radar-geometry.test.ts` — wzorzec „logika prezentacyjna jako
  czysta funkcja w `src/lib/`, testowana bez jsdom".
- `context/foundation/lessons.md` §„Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana,
  nie dwie" — klasa błędu „dwa przełączniki, które muszą się zgadzać, a nic ich nie wiąże".
- `context/foundation/lessons.md` §„Kryteria grepowe kotwicz na składni, nie na słowach" —
  w tym repozytorium proza w komentarzach wielokrotnie trafiała we własne kryteria grepowe.

## Czego NIE robimy

- **Podpowiadanie, która postać lub perk domyka lukę** — jawny Non-Goal PRD (rozważone jako FR-020
  i odrzucone: „solver przeszukujący pulę to najdroższy element logiki w całym MVP").
- **Jakakolwiek zmiana `CompositionGate`, `BELOW_THRESHOLD_MESSAGE` i komunikatu FR-018** —
  niezależność FR-018 od FR-017 jest rozstrzygnięciem PRD, nie przypadkiem.
- **Jakakolwiek zmiana w `src/lib/domain/`** — `missing` jest gotowe; dokładanie tam czegokolwiek
  otwierałoby ponownie zamknięty kontrakt reguły.
- **Zmiana wykresu** — kolor etykiety osi już sygnalizuje przekroczenie progu per kompetencja
  (`CompetencyRadar.tsx:72`); licznik go nie dubluje ani nie modyfikuje.
- **Prop w rodzaju `showMissing` i jakikolwiek tryb wyspy** — S-05 świadomie zlikwidowało parę
  „prop + decyzja w stronie"; ten fragment jej nie wskrzesza. Strony nie zmieniają się wcale.
- **Testy komponentów React, jsdom, snapshoty** — strategia testowania to Moduł 3.
- **Animacje pojawiania się i znikania listy, tooltipy, przejścia układu.**
- **Licznik na `/teams` i `/teams/[id]/embark`** — te trasy nie renderują wyspy i FR-017 ich nie
  dotyczy.
- **Responsywność mobilna** — Non-Goal PRD; lista dziedziczy układ kolumny z S-02.
- **Migracje, trasy API, nowe zależności.**

## Podejście do implementacji

Dwie fazy o rozłącznych powierzchniach. Faza 1 jest w całości czysta i weryfikowalna w CI: wybór
i kolejność wierszy wychodzą z komponentu do funkcji w `src/lib/`, dokładnie tak jak geometria
wykresu w S-02, i dostają własny plik testowy z kontrolą mutacyjną. Faza 2 jest w całości
prezentacyjna: nowy komponent bezstanowy i **przebudowa** — nie rozszerzenie — istniejącej gałęzi
warunkowej w wyspie, tak żeby umowa „czytaj tylko przy pustym `violations`" nadal stała
w jednym miejscu.

Kolejność jest wymuszona: Faza 2 importuje helper z Fazy 1.

## Krytyczne szczegóły implementacji

- **Debugowanie i obserwowalność.** Kryterium 2.2 liczy gałęzie egzekwujące umowę w
  `TeamComposer.tsx` i wymaga dokładnie jednej. Kotwiczy się na **składni otwarcia gałęzi JSX**
  (`^\s*\{evaluation\.violations\.length === 0 \?`), a nie na słowach — zgodnie z `lessons.md`
  §„Kryteria grepowe kotwicz na składni, nie na słowach": odsiew komentarzy jest wyjściem
  awaryjnym na wypadek braku kotwicy, a tutaj kotwica istnieje i proza komentarza nie może jej
  przypadkiem napisać. Filtr komentarzy byłby tu w dodatku dziurawy: blok `{/* … */}` w tym pliku
  ma linie kontynuacji bez żadnego znacznika (`TeamComposer.tsx:123-125`), więc `^\s*(//|\*|/\*|\{/\*)`
  ich nie odsiewa. Niezależnie od kotwicy komentarz dokumentujący gałąź ma nazywać warunek prozą
  („przy pustym `violations`"), a nie powtarzać wyrażenia w postaci kodu — plik jest gęsto
  komentowany po polsku i **opisuje tę umowę słowami**.

---

## Faza 1: Czysty wybór i kolejność wierszy

### Przegląd

Powstaje funkcja zamieniająca `missing` z `TeamEvaluation` na uporządkowaną listę wierszy do
wyrenderowania, plus plik testowy wiążący jej dwie własności: **co** trafia na listę (wyłącznie
kompetencje poniżej progu) i **w jakiej kolejności** (kolejność osi wykresu). Interfejs nie jest
w tej fazie dotykany.

### Wymagane zmiany:

#### 1. Helper wyboru wierszy

**Plik**: `src/lib/missing-competencies.ts` (nowy)

**Cel**: Odsiać z siedmiu sum te kompetencje, którym brakuje punktów, i ustalić kolejność
wierszy raz, w jednym miejscu, poza komponentem — żeby dało się ją udowodnić bez jsdom.
Mieszka w `src/lib/`, a nie w `src/lib/domain/`, bo kolejność wierszy listy jest decyzją
prezentacyjną, nie regułą domenową; dokładnie ta granica dzieli `radar-geometry.ts` od
`evaluate-team.ts`.

**Umowa**: eksportuje typ wiersza `MissingRow` (`competency: Competency`, `missing: number`)
oraz **dwie** czyste funkcje.

1. **Wybór i kolejność** — `missingCompetencies(missing)` → `readonly MissingRow[]`, gdzie wejście
   jest typu `Readonly<Record<Competency, number>>`. Zawiera wyłącznie pozycje o dodatniej liczbie
   braków, w kolejności `COMPETENCIES` z `@/lib/domain` — tej samej tablicy, którą `CompetencyRadar.tsx:21` podaje do `radarLayout`,
   więc lista i osie wykresu nie mogą się rozjechać. Nie mutuje wejścia.
2. **Etykieta wiersza** — `pointsShortLabel(missing: number) → string`: napis z **poprawną
   liczbą gramatyczną**, `1` → „1 point short", każda inna → „N points short". Mieszka tu, a nie
   w komponencie, bo to trzecia reguła tego fragmentu i jedyna, która inaczej zostałaby bez
   dowodu w CI (repozytorium nie ma testów komponentów React). Precedens na napis interfejsu
   w `src/lib/`: `BELOW_THRESHOLD_MESSAGE` w `src/lib/team-submission.ts:40`.

Moduł nie importuje niczego spoza `@/lib/domain` — w szczególności żadnego `astro:*`
ani `@/lib/supabase` (AGENTS.md → Hard rules: testy nie bootstrapują Astro ani Supabase).

#### 2. Test helpera

**Plik**: `src/lib/missing-competencies.test.ts` (nowy)

**Cel**: Związać wszystkie trzy własności wykonywalnym dowodem, żeby regresja w odsiewie,
w kolejności lub w liczbie gramatycznej czerwieniła CI zamiast czekać na weryfikację ręczną.

**Umowa**: konwencja repozytorium bez odstępstw — `import { describe, expect, it } from "vitest";`
w pierwszej linii, blok JSDoc pod importami nazywający wiązaną własność i cytujący FR-017,
polskie nazwy `describe`/`it`, **asercje na literałach z PRD** (`7`, `2`, `1` oraz nazwy siedmiu
kompetencji wypisane wprost), nigdy na importowanych stałych — stałe wolno importować wyłącznie do
budowania wejść. Zakres przypadków:
1. rekord samych zer daje pustą listę;
2. pusty skład (siedem braków po dwa punkty) daje siedem wierszy w kolejności wypisanej literalnie
   jako `["combat", "hacking", "stealth", "engineering", "medicine", "negotiation", "navigation"]`
   — literał jest tu **kotwicą**, bo asercja przez importowaną stałą przeszłaby po każdej zmianie
   kolejności osi wykresu;
3. mieszany rekord wypisuje wyłącznie pozycje niezerowe, z ich liczbami;
4. kolejność wierszy nie zależy od wielkości luk — rekord, w którym braki rosną odwrotnie do
   kolejności osi, nadal wychodzi w kolejności osi;
5. wartości niedodatnie (0 i wartość ujemna) nie trafiają na listę;
6. funkcja nie mutuje przekazanego rekordu (`JSON.stringify` przed i po, wzorem
   `evaluate-team.test.ts:179`);
7. etykieta przy jednym brakującym punkcie jest w liczbie pojedynczej — dokładnie „1 point short";
8. etykieta przy większej liczbie jest w liczbie mnogiej — „2 points short" (literał z pustego
   składu: próg PRD to 2 punkty).

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx astro sync` przechodzi, a po nim `npm run lint` (Node 22.14.0 — najpierw `nvm use`
  i `hash -r`)
- Cały zestaw przechodzi: `npm test`
- Nowy plik biegnie i ma co najmniej osiem przypadków:
  `npx vitest run src/lib/missing-competencies.test.ts`
- **Kontrola mutacyjna A (kolejność)**: odwrócenie kolejności iteracji w helperze czerwieni
  przypadki 2 i 4; mutacja cofnięta, `npm test` znów zielony
- **Kontrola mutacyjna B (odsiew)**: zamiana warunku „braki dodatnie" na „braki nieujemne"
  czerwieni przypadki 1, 3 i 5; mutacja cofnięta, `npm test` znów zielony
- **Kontrola mutacyjna C (liczba gramatyczna)**: usunięcie gałęzi liczby pojedynczej (zawsze
  „points short") czerwieni przypadek 7; mutacja cofnięta, `npm test` znów zielony
- Helper nie sięga po runtime Astro ani Supabase:
  `! grep -nE '^\s*import .* from "(astro:|@/lib/supabase)' src/lib/missing-competencies.ts`
- Domena nietknięta: `git diff --quiet f11ba86 -- src/lib/domain/`
- Bez nowych zależności: `git diff --quiet f11ba86 -- package.json package-lock.json`

#### Ręczna weryfikacja:

- Nazwy przypadków testowych nazywają **własność**, nie implementację, i dają się przeczytać jako
  zdania po polsku — jak w `radar-geometry.test.ts` i `evaluate-team.test.ts`
- Żadna asercja nie używa importowanej stałej tam, gdzie PRD podaje liczbę lub nazwę

**Uwaga implementacyjna**: po zielonych kryteriach automatycznych zatrzymaj się na ręczne
potwierdzenie człowieka przed Fazą 2.

---

## Faza 2: Lista przy wykresie i wspólna gałąź umowy

### Przegląd

Powstaje komponent prezentacyjny renderujący wiersze z Fazy 1, wstawiony w prawej kolumnie między
wykresem a bramką. Istniejąca gałąź `violations.length === 0` zostaje **przebudowana** tak, żeby
obejmowała wykres i listę razem — umowa `evaluate-team.ts` ma być egzekwowana w jednym miejscu,
a nie w dwóch kopiach warunku, które mogą się rozjechać bez sygnału z lintu, typów i testów.

### Wymagane zmiany:

#### 1. Komponent listy

**Plik**: `src/components/team/MissingPointsList.tsx` (nowy)

**Cel**: Nazwać luki, które wykres tylko pokazuje kształtem — czytelność łamigłówki dla persony
recenzenta wchodzącej bez tutoriala (FR-017, `## Success Criteria` → Secondary).

**Umowa**: eksport nazwany `MissingPointsList` (jak `CompetencyRadar` i `CompositionGate`;
domyślne eksporty są w tym repozytorium zarezerwowane dla wysp). Jeden prop:
`missing: Readonly<Record<Competency, number>>` — komponent nie dostaje całego `TeamEvaluation`,
bo nie ma prawa czytać niczego więcej. Bezstanowy, bez efektów, cała logika przychodzi
z `missingCompetencies` i `pointsShortLabel` (Faza 1).

Zwraca `null`, gdy `missingCompetencies` zwróci pustą listę — decyzja „przy domknięciu licznik znika całkowicie":
bramka mówi wtedy „All seven competencies are covered." i drugi komunikat sukcesu byłby
duplikatem.

Renderuje etykietę sekcji i `<ul>` wierszy. Każdy wiersz: nazwa kompetencji stylem z `RosterSlot`
(`text-xs tracking-wide uppercase`, akcent purpurowy) oraz napis z `pointsShortLabel` **wzięty wprost
z helpera Fazy 1** — komponent nie rozgałęzia się na liczbie gramatycznej sam, bo ta gałąź
ma dowód w `npm test`, a nie w oglądaniu ekranu. Paleta cosmic literałami klas Tailwind, `cn()`
wyłącznie tam, gdzie coś jest warunkowe.

#### 2. Wspólna gałąź w wyspie

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Wstawić listę między wykres a bramkę i sprowadzić egzekwowanie umowy odczytu do jednego
warunku, zamiast dokładać drugi obok istniejącego.

**Umowa**: gałąź pozytywna dotychczasowego `evaluation.violations.length === 0` renderuje teraz
fragment z `<CompetencyRadar …>` **oraz** `<MissingPointsList missing={evaluation.missing} />`,
w tej kolejności — fragment nie tworzy węzła DOM, więc `gap-4` z `<aside>` obowiązuje dalej.
`CompositionGate` zostaje pod gałęzią, poza warunkiem, dokładnie tam, gdzie stoi dziś:
`isValid` jest odporne na naruszenia limitu i bramka nie ma prawa zniknąć.

Komunikat gałęzi awaryjnej przestaje być prawdziwy w dotychczasowym brzmieniu („so the chart
cannot be shown"), bo warunek chroni teraz dwa elementy — przeformułować tak, by nazywał oba.

Komentarz nad gałęzią zostaje i zyskuje zdanie o tym, że warunek jest **jeden dla obu
konsumentów**. Ma opisywać warunek prozą („przy pustym `violations`") i **nie** powtarzać wyrażenia
w postaci kodu — patrz „Krytyczne szczegóły implementacji". Kryterium 2.2 kotwiczy się na składni
otwarcia gałęzi JSX, więc proza go nie przewróci; dyscyplina komentarza zostaje jako druga
warstwa, nie jako jedyna ochrona.

Poza tym plik się nie zmienia: żadnego nowego propa, żadnego nowego stanu, żadnego `useMemo`
(react-compiler; koszt to filtr nad siedmioma liczbami, NFR 200 ms z zapasem).

#### 3. Domknięcie zapisów mapy drogowej

**Plik**: `context/foundation/roadmap.md`

**Cel**: Otwarte pytanie nr 1 („Czy S-08 zostaje w zakresie kamienia milowego?") ma właściciela
`użytkownik` i blokuje S-08. Zostało rozstrzygnięte 2026-09-06 — pozostawienie go otwartym po
zaimplementowaniu fragmentu byłoby zapisem nieprawdziwym.

**Umowa**: pozycja 1 w `## Otwarte pytania dotyczące mapy drogowej` przekreślona wzorem pozycji 2
(`~~**…**~~ — **rozstrzygnięte 2026-09-06**: …`), z uzasadnieniem „zostaje: wszystkie pozostałe
fragmenty M-1 są `done`, więc powód do cięcia — domykające się okno czasowe przy ryzyku `time` —
nie zaszedł" i odesłaniem do `context/changes/missing-points-counter/change.md`. Status pozycji
S-08 zmienia `/10x-implement` (`in-progress`) i `/10x-archive` (`done`) — ta faza go nie dotyka.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Pełny łańcuch CI lokalnie, w kolejności z AGENTS.md:
  `npx astro sync && npm run lint && npm test && npm run build`
- **Dokładnie jedna** gałąź egzekwująca umowę w wyspie — kotwica na składni otwarcia gałęzi JSX,
  której proza komentarza napisać nie może; komenda musi wypisać `1`:
  `grep -cE '^\s*\{evaluation\.violations\.length === 0 \?' src/components/team/TeamComposer.tsx`
- Bramka nietknięta: `git diff --quiet f11ba86 -- src/components/team/CompositionGate.tsx`
- Domena, wykres i geometria nietknięte:
  `git diff --quiet f11ba86 -- src/lib/domain/ src/components/team/CompetencyRadar.tsx src/lib/radar-geometry.ts`
- Strony nietknięte (dowód, że nie powstał żaden nowy prop ani tryb) — pathspec `:(literal)`,
  bo `[id]` w zwykłym pathspecu jest klasą znaków, nie nazwą pliku:
  `git diff --quiet f11ba86 -- src/pages/teams/new.astro ':(literal)src/pages/teams/[id].astro'`
- Bez nowych zależności: `git diff --quiet f11ba86 -- package.json package-lock.json`
- Otwarte pytanie nr 1 domknięte — komenda musi zwrócić linię:
  `grep -n '~~\*\*Czy S-08' context/foundation/roadmap.md`
- Komunikat gałęzi awaryjnej faktycznie przeformułowany — stary literał zniknął (gałąź jest
  nieosiągalna z interfejsu, więc żaden krok ręczny jej nie zobaczy):
  `! grep -F 'so the chart cannot be shown' src/components/team/TeamComposer.tsx`

#### Ręczna weryfikacja:

- `/teams/new` z pustym składem: lista pokazuje siedem kompetencji, każda „2 points short",
  w kolejności identycznej z etykietami osi wykresu czytanymi od góry zgodnie z ruchem wskazówek
- Dodanie postaci: jej kompetencja specjalizacji znika z listy natychmiast, bez odczuwalnej zwłoki
  (NFR: poniżej 200 ms)
- Zaznaczenie perka na kompetencji z luką dwóch punktów: wiersz zmienia się na „1 point short"
  (liczba pojedyncza), a nie „1 points short"
- Domknięcie progu przepisem z sześciu postaci: lista znika **w całości**, bramka zielona
  i odblokowana; zdjęcie jednego perka przywraca listę z jednym wierszem i blokuje przycisk
- Komunikat pod przyciskiem jest przez cały czas ten sam, ogólny tekst FR-018 — nie wylicza luk
  i nie znika, gdy lista jest widoczna
- `/teams/[id]` na zapisanej drużynie: listy nie ma; usunięcie członka pokazuje ją natychmiast,
  a przycisk „Save changes" blokuje się — ten sam próg w obie strony
- Prawa kolumna nie przewija się poziomo ani nie rozpycha układu przy siedmiu wierszach
  (`negotiation` i `engineering` to najdłuższe nazwy)

**Uwaga implementacyjna**: po zielonych kryteriach automatycznych zatrzymaj się na ręczne
potwierdzenie człowieka przed zamknięciem fragmentu.

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/missing-competencies.test.ts` — wybór wierszy (tylko braki dodatnie), ich kolejność
  (kolejność osi wykresu, niezależna od wielkości luk), czystość funkcji oraz liczba gramatyczna
  etykiety („1 point short" / „N points short").
- Przypadki brzegowe: same zera (lista pusta), komplet siedmiu braków (stan początkowy
  `/teams/new`), dokładnie jeden brak jednopunktowy (liczba pojedyncza w interfejsie), wartości
  niedodatnie.
- Kontrola mutacyjna wszystkich trzech własności jest częścią kryteriów Fazy 1 — asercja bez
  kontroli mutacyjnej jest dekoracją (`lessons.md` §„Strażnik grepowy…").

### Testy integracyjne:

Brak. Fragment nie dokłada trasy, zapytania ani migracji; jedyną integracją jest przekazanie
`evaluation.missing` między dwoma komponentami w tej samej wyspie, a testów komponentów React
w tym repozytorium nie ma do Modułu 3 (świadome ograniczenie, nie luka).

### Kroki testowania ręcznego:

1. `nvm use && hash -r`, `npm run dev`, zalogować się, otworzyć `/teams/new`.
2. Porównać listę siedmiu wierszy z etykietami osi wykresu — te same nazwy, ta sama kolejność.
3. Dodać jedną postać; sprawdzić, że wiersz jej specjalizacji znika natychmiast.
4. Zaznaczyć perk na kompetencji, której brakuje dwóch punktów; sprawdzić brzmienie
   „1 point short".
5. Domknąć próg; sprawdzić, że lista znika w całości, a bramka jest zielona i odblokowana.
6. Zdjąć jeden perk; sprawdzić, że lista wraca, przycisk się blokuje, a komunikat pod nim to nadal
   ogólny tekst FR-018.
7. Zapisać drużynę, otworzyć ją z `/teams`; sprawdzić brak listy, potem usunąć członka i sprawdzić,
   że lista pojawia się, a „Save changes" blokuje się.
8. Zwęzić okno do progu `lg`, żeby kolumny się złożyły; sprawdzić, że lista nie rozpycha układu.

## Uwagi dotyczące wydajności

Filtr nad siedmioma liczbami przy każdym renderze wyspy, obok istniejącego `evaluateTeam`
(siedem liczników nad ≤ 6 członkami) i `radarLayout`. Bez memoizacji, zgodnie z decyzją S-02:
react-compiler robi to sam, a budżet NFR 200 ms pozostaje z zapasem rzędu wielkości.

## Uwagi dotyczące migracji

Brak. Fragment nie dotyka `supabase/`, schematu, polityk RLS ani żadnych danych. Nie ma stanu
trwałego do przeniesienia, więc nie ma też czego wycofywać poza samym kodem.

## Referencje

- Tożsamość zmiany i pełny zapis decyzji: `context/changes/missing-points-counter/change.md`
- Element mapy drogowej: `context/foundation/roadmap.md` → S-08 (`### S-08: Gracz widzi listę
  brakujących punktów`)
- PRD: FR-017, `## Success Criteria` → Secondary, `## Business Logic`
- Umowa reguły domenowej: `src/lib/domain/evaluate-team.ts:24-40`
- Wzorzec „logika prezentacyjna jako czysta funkcja": `src/lib/radar-geometry.ts`,
  `src/lib/radar-geometry.test.ts`
- Punkt wstawienia: `src/components/team/TeamComposer.tsx:120-133`
- Zarezerwowanie miejsca w S-02: `context/archive/2026-09-05-competency-radar-gate/plan.md:106`
- Wiążące lekcje: `context/foundation/lessons.md` §„Wyspa bez `client:*`…",
  §„Kryteria grepowe kotwicz na składni…", §„Strażnik grepowy nad SQL-em…"

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Kryterium odhacza się dopiero, gdy komenda została uruchomiona
> **dosłownie** i przeszła — `[x]` nie znaczy „intencja spełniona".

### Faza 1: Czysty wybór i kolejność wierszy

#### Automatyczne

- [x] 1.1 `npx astro sync` i `npm run lint` przechodzą — 2791920
- [x] 1.2 `npm test` przechodzi — 2791920
- [x] 1.3 `npx vitest run src/lib/missing-competencies.test.ts` — co najmniej osiem przypadków — 2791920
- [x] 1.4 Kontrola mutacyjna A: odwrócona kolejność czerwieni przypadki 2 i 4, mutacja cofnięta — 2791920
- [x] 1.5 Kontrola mutacyjna B: warunek nieujemny czerwieni przypadki 1, 3 i 5, mutacja cofnięta — 2791920
- [x] 1.6 Kontrola mutacyjna C: brak gałęzi liczby pojedynczej czerwieni przypadek 7, mutacja cofnięta — 2791920
- [x] 1.7 Helper bez runtime'u Astro i Supabase (grep zakotwiczony na `^\s*import … from`) — 2791920
- [x] 1.8 `git diff --quiet f11ba86 -- src/lib/domain/` — 2791920
- [x] 1.9 `git diff --quiet f11ba86 -- package.json package-lock.json` — 2791920

#### Ręczne

- [x] 1.10 Nazwy przypadków nazywają własność, nie implementację — 2791920
- [x] 1.11 Asercje na literałach z PRD, nie na importowanych stałych — 2791920

### Faza 2: Lista przy wykresie i wspólna gałąź umowy

#### Automatyczne

- [x] 2.1 `npx astro sync && npm run lint && npm test && npm run build` — 996b000
- [x] 2.2 Dokładnie jedna gałąź otwierająca `{evaluation.violations.length === 0 ?` w `TeamComposer.tsx` (grep zakotwiczony na składni JSX wypisuje `1`) — 996b000
- [x] 2.3 `git diff --quiet f11ba86 -- src/components/team/CompositionGate.tsx` — 996b000
- [x] 2.4 `git diff --quiet f11ba86 -- src/lib/domain/ src/components/team/CompetencyRadar.tsx src/lib/radar-geometry.ts` — 996b000
- [x] 2.5 `git diff --quiet f11ba86 -- src/pages/teams/new.astro ':(literal)src/pages/teams/[id].astro'` — 996b000
- [x] 2.6 `git diff --quiet f11ba86 -- package.json package-lock.json` — 996b000
- [x] 2.7 `grep -n '~~\*\*Czy S-08' context/foundation/roadmap.md` zwraca linię — 996b000
- [x] 2.8 Komunikat gałęzi awaryjnej przeformułowany: `! grep -F 'so the chart cannot be shown' src/components/team/TeamComposer.tsx` — 996b000

#### Ręczne

- [x] 2.9 Pusty skład: siedem wierszy „2 points short" w kolejności osi wykresu — 996b000
- [x] 2.10 Dodanie postaci usuwa wiersz jej specjalizacji natychmiast — 996b000
- [x] 2.11 Jeden brakujący punkt daje „1 point short" (liczba pojedyncza) — 996b000
- [x] 2.12 Domknięcie progu usuwa listę w całości; zdjęcie perka ją przywraca i blokuje przycisk — 996b000
- [x] 2.13 Komunikat FR-018 pod przyciskiem niezmieniony i widoczny niezależnie od listy — 996b000
- [x] 2.14 `/teams/[id]`: brak listy na zapisanej drużynie; usunięcie członka pokazuje ją i blokuje „Save changes" — 996b000
- [x] 2.15 Siedem wierszy nie rozpycha układu ani nie przewija poziomo — 996b000
