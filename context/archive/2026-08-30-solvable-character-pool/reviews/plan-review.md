<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Rozwiązywalna pula 10–12 postaci wraz z perkami

- **Plan**: `context/changes/solvable-character-pool/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-05
- **Werdykt**: DO POPRAWY → **SOLIDNY** po sortowaniu (2026-09-05)
- **Ustalenia**: 0 krytycznych, 4 ostrzeżenia, 3 obserwacje

## Sortowanie (2026-09-05)

| Wynik      | Ustalenia                                                        |
| ---------- | ---------------------------------------------------------------- |
| Naprawione | F2, F3, F4, F5, F6, F7 (F7 w wariancie „zostaw z komentarzem")   |
| Odrzucone  | F1 — użytkownik nie zgadza się z ustaleniem                      |

Po poprawkach: Postęp↔Fazy nadal spójne (4 fazy, 4 nagłówki w Postępie, zero pól wyboru poza
sekcją Postęp, Faza 4 ma 4.1–4.6).

## Werdykty

| Wymiar                       | Werdykt                    |
| ---------------------------- | -------------------------- |
| Zgodność ze stanem końcowym  | ZALICZONY                  |
| Oszczędne wykonanie          | OSTRZEŻENIE (1 obserwacja) |
| Dopasowanie architektoniczne | OSTRZEŻENIE (1 obserwacja) |
| Martwe punkty                | OSTRZEŻENIE (2 ustalenia)  |
| Kompletność planu            | OSTRZEŻENIE (3 ustalenia)  |

## Ugruntowanie

8/8 ścieżek ✓, 6/6 symboli ✓, brief↔plan ✓, Postęp↔Fazy ✓ (polskie nagłówki `## Faza N:` /
`#### Automatyczne` / `#### Ręczne` mają precedens w zarchiwizowanym planie F-01, który
`/10x-implement` przetworzył bez zarzutu).

Odniesienia liniowe dryfują o kilka linii (`evaluate-team.ts:60` → `:54`, `types.ts:53` → `:51`,
`types.ts:12` → `:13`) — bez wpływu na wykonanie.

Zweryfikowane w kodzie (podagent, prototypy w scratchpadzie):

- Zawężenie `perks: readonly PoolPerk[]` w `PoolCharacter extends Character` kompiluje się pod
  tsconfig repo (`astro/tsconfigs/strict`, tsc 5.9.3); `readonly PoolCharacter[]` wchodzi do
  `evaluateTeam` bez rzutowania.
- Solver z przycięciem braków do 0–2 i memoizacją po `(indeks, liczba członków, stan)` zamyka pulę
  12 postaci w ~10–20 ms i zgadza się z brute force na TEST_POOL (830 871 par, identycznie).
- `@supabase/postgrest-js` 2.105.3 wspiera `.order(col, { referencedTable })`; `SupabaseClient`
  jest eksportowany z `@supabase/supabase-js`.
- Poza `src/lib/domain/` nic nie importuje modułu domenowego — zmiany w `types.ts` są addytywne.

## Ustalenia

### F1 — Kalibracja „dziesiątki rozwiązań" jest o 5 rzędów wielkości za nisko

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 → poz. 3 (`countThresholdSolutions`) i poz. 4 („Kalibracja")
- **Szczegóły**: Plan definiuje licznik jako „liczbę wszystkich domykających par (podzbiór, przypisanie perków)" i każe asercji sprawdzać próg „rzędu dziesiątek". Pomiar na prototypie: TEST_POOL (8 postaci) daje 830 871 par, trzy losowe pule 12-osobowe z kompletem specjalizacji — 12,7–14,5 mln. Najostrzejsza sensowna miara (różne zbiory postaci z choć jednym domykającym przypisaniem perków) to ~1100. Asercja „> dziesiątki" nie zaczerwieni się przy żadnym realnym spadku rozwiązywalności. Umowa nie rozstrzyga też, czy skład domykający próg przy k < 6 członkach liczy się raz, czy z każdym dopełnieniem — to zmienia wynik o rzędy wielkości.
- **Poprawka A ⭐ Zalecana**: Zmień miarę na „liczba różnych zbiorów postaci (bez rozróżniania perków), dla których istnieje domykające przypisanie", a próg ustal po pierwszym pomiarze jako ~połowę zmierzonej wartości, z komentarzem podającym wartość bazową i datę.
  - Siła: Miara ma interpretację („ile drużyn da się domknąć"), a próg związany z pomiarem faktycznie czerwieni się przy realnym spadku.
  - Kompromis: Próg jest liczbą empiryczną w teście — przy świadomej zmianie puli trzeba go zaktualizować i uzasadnić.
  - Pewność: WYSOKA — liczby zmierzone na prototypie zgodnym z opisem planu.
  - Martwy punkt: Nie zmierzono, jak miara reaguje na usunięcie jednej postaci — sprawdzić przy ustalaniu progu.
- **Poprawka B**: Usuń kalibrację i `countThresholdSolutions`; zostaje `findThresholdSolution` + `evaluateTeam` jako jedyny dowód (dokładnie wiążący warunek PRD).
  - Siła: Mniej kodu; brief sam zapisuje, że kalibracja to wybór projektowy, nie zapis PRD.
  - Kompromis: Tracimy jedyny sygnał „pula zrobiła się trudniejsza".
  - Pewność: WYSOKA — PRD wymaga wyłącznie istnienia rozwiązania.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: ODRZUCONE — użytkownik nie zgadza się z ustaleniem (2026-09-05)

### F2 — Rozjazd nazw enuma `competency` z `COMPETENCIES` przechodzi niezauważony

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 → poz. 4 (przypadek „kompletność enuma"); Faza 3 → `mapPoolRows`
- **Szczegóły**: Test kompletności porównuje tylko liczbę wartości enuma z długością `COMPETENCIES` — siedem wartości o innej nazwie przechodzi; wymaga też wyłuskania wartości z SQL, czyli mini-parsera, którego plan unika przy seedzie. `mapPoolRows` rzutuje `specialization`/`competency` z bazy na `Competency` bez sprawdzenia; nieznana wartość daje w `evaluateTeam` `scores[x] += 2` → `NaN` pod kluczem spoza `COMPETENCIES`, którego pętla progu nie odwiedza — cicho.
- **Poprawka**: Renderer dostaje `renderCompetencyEnum(COMPETENCIES)` zwracającą pełne `create type public.competency as enum (...)`; test sprawdza dosłowne zawieranie w migracji schematu (wzorzec jak przy seedzie). `mapPoolRows` rzuca, gdy wartość nie należy do `COMPETENCIES` — z osobnym przypadkiem w teście mapowania.
- **Decyzja**: NAPRAWIONE — plan: Faza 2 poz. 2 (`renderCompetencyEnum`) i poz. 4 (dosłowne zawieranie w migracji schematu), Faza 3 poz. 1–2 (walidacja kompetencji w `mapPoolRows` + przypadek testowy), Strategia testowania

### F3 — Kryterium 3.4 jest puste w bashu: `src/**/*.test.ts` nie sięga do podkatalogów

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 → Automatyczna weryfikacja (3.4); kryteria 1.4 i 2.4
- **Szczegóły**: Zmierzone: bash 3.2 (domyślny na macOS) bez `globstar` rozwija `src/**/*.test.ts` do samego `src/lib/utils.test.ts`; wykonane polecenie to `grep -rl lib/supabase src/lib/utils.test.ts`. Każdy test w podkatalogu (`src/lib/domain/`) jest pomijany — kryterium przechodzi na pusto. Osobno: 1.4/2.4 (`grep -rE "astro:|lib/supabase" src/lib/domain/`) wyłapują też komentarze — plan sam sugeruje treść komentarza „nie jest to `astro:*` ani `@/lib/supabase`" dla testu zgodności, który wyląduje w `domain/`.
- **Poprawka**: 3.4 → `grep -rl "lib/supabase" --include='*.test.ts' src`. 1.4/2.4 → ogranicz do linii importu: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/`, albo dopisz w planie, że komentarze w `domain/` nie cytują tych tokenów dosłownie.
- **Decyzja**: NAPRAWIONE — kryteria 1.4, 2.4, 3.4 podmienione w blokach faz i w Postępie; obie nowe formy sprawdzone na bieżącym drzewie (exit 1 = brak dopasowań)

### F4 — Mapa drogowa F-02 zaprzecza planowi i nie ma kroku, który ją domknie

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 4 → Ręczna weryfikacja; `context/foundation/roadmap.md:135-159`
- **Szczegóły**: Wpis F-02 mówi: „Fundament nie buduje warstwy danych — dostarcza jeden zbiór danych plus jego dowód poprawności", a obie „Niewiadome" mają status nierozstrzygnięty. Plan — decyzją użytkownika — buduje pierwszą migrację, RLS i repozytorium odczytu. Żadna faza nie aktualizuje wpisu. Powtórka ustalenia F1 z przeglądu implementacji F-01 („mapa drogowa nie została domknięta").
- **Poprawka**: Dodaj do Fazy 4 kryterium ręczne 4.6: wpis F-02 w `roadmap.md` odzwierciedla decyzję, obie Niewiadome są rozstrzygnięte, a wpis S-03 odnotowuje, że pierwsza migracja i warsztat Supabase już istnieją.
- **Decyzja**: NAPRAWIONE — Faza 4: akapit o domknięciu wpisu F-02 w umowie, nowe kryterium ręczne 4.6 w bloku fazy i w Postępie

### F5 — Nowe typy i pula omijają barrel `src/lib/domain/index.ts`

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 1 → poz. 1–2
- **Szczegóły**: Istniejący test i fixture importują z `@/lib/domain` (barrel). Plan dopisuje `PoolPerk`, `PoolCharacter` i `CHARACTER_POOL`, ale nie wspomina o `index.ts` — S-01 sięgnie po nie głęboką ścieżką, wbrew konwencji.
- **Poprawka**: W Fazie 1 dopisz re-eksport `PoolPerk`, `PoolCharacter` i `CHARACTER_POOL` z `src/lib/domain/index.ts`. Solver zostaje poza barrelem — jak `test-fixtures.ts`, ma wyłącznie konsumentów testowych.
- **Decyzja**: NAPRAWIONE — Faza 1 poz. 1: dopisany blok `src/lib/domain/index.ts` z umową re-eksportu

### F6 — Przyszła wymiana treści przez „skasuj i wstaw" zderzy się z `teams` z S-03

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 → poz. 2–3; „Uwagi dotyczące migracji"
- **Szczegóły**: Uwagi migracyjne przewidują zmianę treści jako „skasowanie i ponowne wstawienie wierszy". Gdy S-03 doda `teams` z kluczem obcym do `characters(id)`, `delete` albo zawiedzie, albo skasuje zapisane drużyny. Renderer emitujący `insert … on conflict (id) do update set …` jest idempotentny, obsługuje pierwszy zasiew i każdą późniejszą korektę tym samym tekstem, a test zgodności nie zmienia się.
- **Poprawka**: Niech `renderCharacterPoolInserts` emituje upsert (`on conflict (id) do update`), a w Uwagach migracyjnych zamień „skasowanie i ponowne wstawienie" na „nowa migracja z tym samym wyrenderowanym blokiem upsert (+ jawne `delete` tylko dla usuniętych identyfikatorów)".
- **Decyzja**: NAPRAWIONE — Faza 2 poz. 2 (renderer emituje upsert) i poz. 3 (umowa migracji zasiewowej), „Uwagi dotyczące migracji"

### F7 — Przypadek „sześć postaci bez perków" nie potrafi się zaczerwienić

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 1 → poz. 4 („Właściwość liczbowa z PRD")
- **Szczegóły**: Sześć specjalizacji pokrywa najwyżej sześć z siedmiu kompetencji dla dowolnej puli — przypadek jest prawdziwy niezależnie od treści `CHARACTER_POOL`, więc nie pilnuje puli, tylko powtarza test reguły z `evaluate-team.test.ts:89` na innych danych. Koszt znikomy (924 wywołania) — kwestia czytelności zestawu, nie budżetu.
- **Poprawka**: Usuń ten przypadek z zestawu puli albo zostaw go z komentarzem, że dokumentuje właściwość PRD, a nie waliduje dane.
- **Decyzja**: NAPRAWIONE (wariant „zostaw z komentarzem") — Faza 1 poz. 4: umowa nazywa przypadek dokumentacją zapisu PRD, nie kontrolą puli
