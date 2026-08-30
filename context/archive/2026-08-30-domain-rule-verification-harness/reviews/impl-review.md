<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Wykonywalna weryfikacja reguły siedmiu kompetencji

- **Plan**: context/changes/domain-rule-verification-harness/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny przegląd planu)
- **Data**: 2026-08-30
- **Werdykt wyjściowy**: WYMAGA UWAGI
- **Werdykt po triażu**: ✅ **ZAAKCEPTOWANO** — wszystkie 5 ustaleń naprawionych 2026-08-30, zero otwartych
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje — **5 z 5 zamkniętych jako FIXED**
- **Status**: zamknięty

## Werdykty

| Wymiar | Werdykt wyjściowy | Po triażu | Domknięte przez |
|---|---|---|---|
| Zgodność z planem | PASS | ✅ PASS | — |
| Dyscyplina zakresu | WARNING | ✅ PASS | F1 |
| Bezpieczeństwo i jakość | WARNING | ✅ PASS | F4 |
| Architektura | PASS | ✅ PASS | — |
| Spójność wzorców | WARNING | ✅ PASS | F3, F5 |
| Kryteria sukcesu | WARNING | ✅ PASS | F2 |

Żaden wymiar nie pozostaje w stanie WARNING ani FAIL. Każde ostrzeżenie ma przypisane
ustalenie, każde ustalenie ma decyzję FIXED i dowód weryfikacji poniżej.

## Dowody weryfikacji

Uruchomione w trakcie przeglądu (Node 22.14.0 z `.nvmrc`):

- `npm test` → 2 pliki, 14 przypadków, wszystkie zielone (162 ms)
- `npm run lint` → exit 0
- `npx astro sync && npm run build` → `[build] Complete!`
- `grep -rE "astro:|lib/supabase" src/lib/domain/` → brak dopasowań (czystość modułu potwierdzona)
- `.github/workflows/ci.yml:21` → `npm test` stoi między `npm run lint` a `npm run build`; krok bez bloku `env`
- Mutacja `COMPETENCY_THRESHOLD` 2 → 1 → 1 z 14 przypadków czerwony (patrz F2)
- Mutacja `MAX_TEAM_SIZE` 6 → 7 → 2 z 14 przypadków czerwone
- Mutacja `MAX_PERKS_PER_MEMBER` 2 → 3 → 1 z 14 przypadków czerwony
- Drzewo robocze czyste po wszystkich mutacjach

Wszystkie pola wyboru `[x]` w `## Postęp` mają pokrycie w diffie — nie znaleziono „podpisywania na ślepo".

## Ustalenia

### F1 ✅ ZAMKNIĘTE — Mapa drogowa nie została domknięta po zakończeniu planu

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: context/foundation/roadmap.md:60, :133, :310, :326
- **Szczegóły**: Commit fazy 1 zmienił `roadmap.md` (F-01: `planning` → `in-progress`) mimo że plik nie występuje w „Wymagane zmiany" żadnej fazy. Commit epilogowy `a2df4fc` domknął `change.md` (`implemented`) i `plan.md`, ale mapy drogowej już nie tknął. W efekcie F-01 nadal ma status `in-progress` w tabeli fragmentów (:60) i w sekcji opisowej (:133), tabela „Przekazanie do backlogu" (:310) wciąż każe uruchomić `/10x-plan domain-rule-verification-harness`, a otwarte pytanie #2 (:326) figuruje jako otwarte, choć `change.md` odnotowuje je jako rozstrzygnięte („wyłącznie czysta reguła domenowa"). Sama edycja poza planem jest nieszkodliwa — niedomknięcie jej nie jest.
- **Poprawka**: Zaktualizuj `roadmap.md` w czterech miejscach: status F-01 na `done` (:60, :133), wpis backlogu na wykonany (:310), otwarte pytanie #2 na rozstrzygnięte z odesłaniem do `change.md`. Rozważ też odblokowanie F-02 (`Czeka na F-01` → gotowe do `/10x-plan`).
- **Decyzja**: FIXED — roadmap.md domknięty: F-01 `done` w tabeli fragmentów i w sekcji opisowej, wpis backlogu na wykonany, otwarte pytanie #2 oznaczone jako rozstrzygnięte 2026-08-30, „Niewiadome” F-01 zamknięte, F-02 odblokowane do `/10x-plan solvable-character-pool`.

### F2 ✅ ZAMKNIĘTE — Zestaw testowy współmutuje ze stałą, którą ma pinować

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: src/lib/domain/evaluate-team.test.ts:15, :35, :67
- **Szczegóły**: Mutacja kontrolna z kryterium 3.4 (`COMPETENCY_THRESHOLD` 2 → 1) czerwieni **dokładnie jeden** z czternastu przypadków — „skład o dokładnie jeden punkt za krótki". Pozostałe trzynaście przechodzi, bo kluczowe asercje są wyrażone przez samą stałą, a nie przez liczbę z PRD: `:35` `expect(result.missing[c]).toBe(COMPETENCY_THRESHOLD)`, `:67` `expect(result.scores.navigation).toBe(COMPETENCY_THRESHOLD - 1)`, `:15` `everyCompetencyAtThreshold()` używany w pięciu przypadkach limitów. Przy progu 1 test „skład domykający próg" i test właściwości liczbowej („sześć specjalizacji na siedem kompetencji") nadal przechodzą — a to one niosą najcięższy zapis PRD. Kryterium 3.4 formalnie spełnione, ale zestaw pinuje regułę słabiej, niż sugeruje. Dla zmiany, której **jedynym produktem** jest harness weryfikacyjny, to trafia w rdzeń.
- **Poprawka A ⭐ Zalecane**: Zamień asercje specyfikacyjne na literały z PRD — `:35` na `.toBe(2)`, `:67` na `.toBe(1)`, a w `everyCompetencyAtThreshold` porównuj do literału `2`. Stała zostaje w kodzie produkcyjnym jako jedno źródło, testy przestają za nią podążać.
  - Siła: Przywraca właściwość, po którą sięga kryterium 3.4 — poluzowanie progu wywala większość zestawu, nie jeden przypadek. Zgodne z tym, jak testy już traktują punktację (`:48` `expect(result.scores.combat).toBe(6)` to literał).
  - Kompromis: Jeśli F-02 świadomie zmieni próg, trzeba dotknąć kilku asercji zamiast żadnej — ale to jest właśnie pożądany sygnał.
  - Pewność: WYSOKA — zweryfikowane empirycznie mutacją; przyczyna przeżycia 13 przypadków jest jednoznaczna.
  - Martwy punkt: Nie sprawdzono, czy F-02 planuje zmianę progu; jeśli tak, koszt utrzymania rośnie nieznacznie.
- **Poprawka B**: Zostaw asercje symboliczne i dołóż osobny przypadek pinujący same stałe (`expect(COMPETENCY_THRESHOLD).toBe(2)`, `MAX_TEAM_SIZE` 6, `MAX_PERKS_PER_MEMBER` 2).
  - Siła: Jeden mały test, zero zmian w istniejących asercjach; mutacja dowolnej stałej natychmiast czerwieni zestaw.
  - Kompromis: Pinuje liczbę, nie zachowanie — test „stała równa się stałej" nie mówi nic o tym, co reguła robi z tą liczbą; reszta zestawu pozostaje tak samo miękka.
  - Pewność: ŚREDNIA — domyka kryterium mutacyjne, ale nie usuwa przyczyny.
  - Martwy punkt: Nie chroni przed zmianą w `evaluateTeam`, która przestaje stałej używać.
- **Decyzja**: Fixed via Fix A — asercje specyfikacyjne wyrażone literałami z PRD (`:35` → `toBe(2)`, `:67` → `toBe(1)`, `everyCompetencyAtThreshold` porównuje do `2`), import `COMPETENCY_THRESHOLD` usunięty z testu wraz z komentarzem wyjaśniającym dlaczego. Kontrola: mutacja progu 2 → 1 czerwieni teraz 2 niezależne przypadki zamiast 1.

### F3 ✅ ZAMKNIĘTE — README nadal nie zna `npm test`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: README.md:50-57, README.md:171
- **Szczegóły**: Faza 1 postawiła sobie za cel „dokumentację zgodną z rzeczywistością" i poprawiła `AGENTS.md`, ale plan nie wymienił `README.md` — a `AGENTS.md` wskazuje go jako źródło układu projektu i listy poleceń. Sekcja „Available Scripts" (:50-57) wylicza sześć skryptów bez `test`, a :171 opisuje CI jako „lint + build", pomijając nowy krok. Dokumentacja, którą faza miała przestać kłamać, kłamie dalej w drugim pliku. Uwaga poboczna: :171 mówi też o gałęzi `master`, gdy CI działa na `main` — to defekt zastany, nie z tej zmiany.
- **Poprawka**: Dopisz `- \`npm test\` - Run Vitest suite (single pass)` do listy skryptów i zaktualizuj :171 na „lint + test + build".
- **Decyzja**: FIXED — README.md: `npm test` dopisane do „Available Scripts”, opis CI zmieniony na „lint + test + build”; przy okazji poprawiona zastana nazwa gałęzi `master` → `main` (na wyraźny wybór użytkownika).

### F4 ✅ ZAMKNIĘTE — `scores` nalicza punkty z wyborów, które reguła właśnie odrzuciła

- **Ważność**: 📝 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/domain/evaluate-team.ts:65-87
- **Szczegóły**: Naruszenie limitu jest odnotowywane, ale punktowanie leci dalej po tym samym wejściu. Trzeci perk u jednego członka dokłada punkt do `scores` mimo `too-many-perks` (:65 tylko zapisuje naruszenie, pętla :78 przetwarza wszystkie `perkIds`); ta sama postać wybrana dwukrotnie dokłada specjalizację dwa razy (:76 wykonuje się dla obu wystąpień). `isValid` jest poprawne — pozostaje `false`. Ale `TeamEvaluation` jest z założenia jednym źródłem dla wykresu z S-02, licznika z S-08 i bramki zapisu, a Guardrail PRD brzmi „wykres zawsze zgodny ze składem". Konsument, który narysuje `scores` dla składu z naruszeniem, pokaże punkty, których reguła nie przyznaje. Plan nie rozstrzygnął tego przypadku w żadną stronę — to luka kontraktu, nie błąd implementacji.
- **Poprawka**: Rozstrzygnij kontrakt jawnie — albo w dokumentacji `TeamEvaluation` (`scores` odzwierciedla surowy wybór gracza, konsument rysuje wykres tylko gdy `violations` jest puste), albo w kodzie (pomijaj punktowanie odrzuconych wyborów). Decyzja i tak zapadnie w S-02; taniej zapisać ją teraz, gdy jest jedno miejsce do zmiany.
- **Decyzja**: FIXED — kontrakt rozstrzygnięty w dokumentacji, bez zmiany zachowania: JSDoc `TeamEvaluation.scores` mówi teraz wprost, że sumy odzwierciedlają surowy wybór gracza (łącznie z odrzuconym) i że konsument S-02/S-08 czyta je wyłącznie przy pustym `violations`.

### F5 ✅ ZAMKNIĘTE — `PERKS_PER_CHARACTER` jest stałą martwą

- **Ważność**: 📝 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/domain/types.ts:35
- **Szczegóły**: `PERKS_PER_CHARACTER = 3` jest zdefiniowane i re-eksportowane przez `index.ts:7`, ale nie używa go ani `evaluateTeam`, ani żaden test, ani fixture. Postacie w `TEST_POOL` mają po trzy perki wyłącznie z konwencji — nic tego nie sprawdza. Stała jest zgodna z planem (dosłownie z jego bloku kontraktowego), więc nie jest to odchylenie; jest to jednak jedyny element publicznej powierzchni modułu bez pokrycia zachowaniem, a właśnie tego rodzaju stała cicho rozjeżdża się z danymi w F-02.
- **Poprawka**: Dołóż do zestawu jeden przypadek walidujący pulę — każda postać w `TEST_POOL` ma dokładnie `PERKS_PER_CHARACTER` perków o unikalnych identyfikatorach. Jedno zdanie, a stała zaczyna cokolwiek znaczyć i F-02 dostaje gotowy wzorzec dla puli docelowej.
- **Decyzja**: FIXED — nowy blok `describe("pula postaci")` w `evaluate-team.test.ts`: każda postać w `TEST_POOL` ma dokładnie `PERKS_PER_CHARACTER` perków o unikalnych identyfikatorach. Kontrola: mutacja stałej 3 → 4 czerwieni zestaw. Zestaw liczy teraz 15 przypadków.

## Triaż — 2026-08-30

Wszystkie pięć ustaleń rozstrzygniętych jako „napraw teraz”. Zero pominięć, zero odrzuceń,
zero pozycji zakolejkowanych do `follow-ups/`.

| Ustalenie | Decyzja |
|---|---|
| F1 | Naprawione |
| F2 | Naprawione (Poprawka A) |
| F3 | Naprawione (+ zastany `master` → `main`) |
| F4 | Naprawione (dokumentacja kontraktu) |
| F5 | Naprawione (+ nowy przypadek testowy) |

Weryfikacja po triażu (Node 22.14.0, pełna sekwencja CI):
`npx astro sync` → 0; `npm run lint` → 0; `npm test` → **15/15 zielonych**; `npm run build` → Complete.

Kontrole mutacyjne po poprawkach:
- `COMPETENCY_THRESHOLD` 2 → 1 → 2 przypadki czerwone (przed triażem: 1)
- `MAX_TEAM_SIZE` 6 → 7 → 2 przypadki czerwone
- `PERKS_PER_CHARACTER` 3 → 4 → 1 przypadek czerwony (przed triażem: 0 — stała była martwa)
