---
change_id: missing-points-counter
title: Gracz widzi listę brakujących punktów
status: implemented
created: 2026-09-06
updated: 2026-09-06
---

## Notes

- Element mapy drogowej: **S-08** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień C —
  czytelność łamigłówki). Ostatni niedowieziony fragment M-1 i **jedyny** o priorytecie
  „miły dodatek".
- Odnośniki PRD: FR-017 (priorytet: miły dodatek), `## Success Criteria` → Secondary
  („Widoczny licznik brakujących punktów: obok wykresu pajęczynowego lista kompetencji poniżej
  progu wraz z liczbą brakujących punktów").
- Wymaganie wstępne: S-02 (`competency-radar-gate`), zarchiwizowane 2026-09-05.
- **Domyka otwarte pytanie nr 1 mapy drogowej** („Czy S-08 zostaje w zakresie kamienia milowego?").
  Rozstrzygnięcie: **zostaje**, wykonane 2026-09-06. Wszystkie pozostałe fragmenty M-1 są `done`,
  więc pierwotny powód do cięcia — domykające się okno czasowe przy ryzyku `time` — nie zaszedł.
- **Punkt wyjścia jest nietypowo płytki: reguła jest już policzona i przetestowana.**
  `evaluateTeam` zwraca `missing: Record<Competency, number>` od F-01
  (`src/lib/domain/evaluate-team.ts:36`, obliczenie `:109-119`, asercje
  `evaluate-team.test.ts:49, 65, 72, 82`). Fragment nie liczy nic nowego — **renderuje** jedyną
  wartość `TeamEvaluation`, której żaden komponent nie czyta.
- Miejsce zostało zarezerwowane w S-02: `context/archive/2026-09-05-competency-radar-gate/plan-brief.md`
  („S-08 ma gdzie dodać licznik »obok wykresu«") i `plan.md:106` („`evaluation.missing` jest
  liczone, ale nie renderowane").
- Wiążąca umowa odczytu, wymieniająca S-08 imiennie: JSDoc `TeamEvaluation.scores`
  (`evaluate-team.ts:24-33`) — konsument czyta `scores`/`missing` **wyłącznie przy pustym
  `violations`**, inaczej pokaże punkty, których reguła nie przyznaje, wbrew Guardrailowi PRD
  „wykres zawsze zgodny ze składem". Ustalone w triażu przeglądu F-01 (F5, decyzja FIXED).
- Wiążące lekcje z `context/foundation/lessons.md`:
  - §„Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana, nie dwie" — klasa „dwa
    przełączniki, które muszą się zgadzać, a nic ich nie wiąże". Stąd decyzja o **wspólnej gałęzi**
    `violations.length === 0` dla wykresu i licznika zamiast drugiego, niezależnego warunku.
  - §„Kryteria grepowe kotwicz na składni, nie na słowach" — kryteria automatyczne tego planu
    biegną po plikach, w których proza opisuje dokładnie to, czego grep ma nie znaleźć.
- Decyzje projektowe z sesji planowania 2026-09-06 (`/10x-plan`, złożoność NISKA, 6 pytań):
  - **Obie strony, bez nowego propa.** Licznik żyje w `TeamComposer`, więc pojawia się na
    `/teams/new` i `/teams/[id]` za darmo. Odrzucono `showMissing` przekazywany ze strony —
    przywracałby parę przełączników „prop w wyspie + decyzja w stronie", którą S-05 świadomie
    zlikwidowało.
  - **Przy domknięciu licznik znika całkowicie.** Bramka mówi już „All seven competencies are
    covered."; drugi komunikat sukcesu o wiersz niżej byłby duplikatem.
  - **`CompositionGate` nietknięty.** FR-018 pozostaje niezależny od FR-017 zgodnie
    z rozstrzygnięciem PRD — wycięcie tego fragmentu nie tyka bramki ani żadnego Guardraila.
  - **Kolejność stała, jak osie wykresu** (`COMPETENCIES`), tylko kompetencje poniżej progu.
    Odrzucono sortowanie po wielkości luki: wiersze przeskakiwałyby przy każdym kliknięciu perka.
  - **Czysty helper w `src/lib/` z własnym testem**, precedens `radar-geometry.ts` z S-02.
    Kolejność wierszy to decyzja prezentacyjna, nie reguła domenowa — nie wchodzi do
    `src/lib/domain/`.
  - **Jedna gałąź `violations.length === 0`** obejmująca wykres i licznik, zamiast dwóch kopii
    warunku umowy.
- Nie wymaga migracji bazy, trasy API ani nowej zależności. Nie dotyka `supabase/`.
