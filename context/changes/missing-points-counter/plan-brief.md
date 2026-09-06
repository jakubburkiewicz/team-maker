# Licznik brakujących punktów (S-08) — Krótki plan

> Pełny plan: `context/changes/missing-points-counter/plan.md`

## Co i dlaczego

Obok wykresu pajęczynowego ma stanąć lista kompetencji poniżej progu wraz z liczbą brakujących
punktów (FR-017, `## Success Criteria` → Secondary). Wykres pokazuje lukę kształtem; lista ją
**nazywa**, czyli prowadzi recenzenta przez łamigłówkę bez tutoriala. To ostatni niedowieziony
fragment kamienia milowego M-1 i jedyny o priorytecie „miły dodatek".

## Punkt wyjścia

Reguła jest już policzona i przetestowana: `evaluateTeam` zwraca `missing` od F-01
(`src/lib/domain/evaluate-team.ts:36`), z asercjami w `evaluate-team.test.ts`. Jest to **jedyna**
wartość `TeamEvaluation`, której żaden komponent nie czyta — S-02 świadomie ją zostawił
(„`evaluation.missing` jest liczone, ale nie renderowane") i zarezerwował dla niej miejsce
w prawej kolumnie wyspy. Ten fragment nic nie liczy; on renderuje.

## Pożądany stan końcowy

Między wykresem a przyciskiem stoi lista kompetencji z lukami, w tej samej kolejności co osie
wykresu. Pusty skład to siedem wierszy po „2 points short"; każde dodanie postaci lub perka skraca
listę natychmiast; domknięcie progu usuwa ją w całości. Ta sama lista działa na `/teams/new`
i `/teams/[id]`, bez jednego nowego propa i bez tknięcia bramki zapisu.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Powierzchnia | Obie strony, przez samą wyspę | Licznik w `TeamComposer` pojawia się wszędzie za darmo; prop `showMissing` wskrzesiłby parę „prop + decyzja w stronie", którą S-05 świadomie zlikwidowało. |
| Stan domknięty | Lista znika całkowicie | Bramka mówi już „All seven competencies are covered." — drugi komunikat sukcesu o wiersz niżej byłby duplikatem. |
| Komunikat FR-018 | `CompositionGate` nietknięty | Niezależność FR-018 od FR-017 jest rozstrzygnięciem PRD: wycięcie tego fragmentu nie może zostawić szarego przycisku bez wyjaśnienia. |
| Kolejność wierszy | Stała, jak osie wykresu | Wzrok przenosi się między listą a wielokątem 1:1, a wiersze nie przeskakują przy każdym kliknięciu perka. |
| Pokrycie testowe | Czysty helper w `src/lib/` + własny test | Precedens `radar-geometry.ts` z S-02: logika prezentacji dostaje dowód w CI bez jsdom, a kolejność wierszy nie wchodzi do domeny, bo nie jest regułą. |
| Umowa `violations` | Jedna wspólna gałąź z wykresem | Umowa „czytaj tylko przy pustym `violations`" ma być egzekwowana raz — dwie kopie warunku to klasa błędu z `lessons.md` §„para przełączników". |

## Zakres

**W zakresie:** `src/lib/missing-competencies.ts` + test z kontrolą mutacyjną obu własności;
`MissingPointsList` w `src/components/team/`; przebudowa istniejącej gałęzi warunkowej
w `TeamComposer` na wspólną dla wykresu i listy; przeformułowanie komunikatu awaryjnego tej
gałęzi; domknięcie otwartego pytania nr 1 mapy drogowej.

**Poza zakresem:** jakakolwiek zmiana w `src/lib/domain/`, `CompetencyRadar`, `CompositionGate`
i obu stronach `.astro`; podpowiadanie, co domyka lukę (Non-Goal PRD, odrzucone FR-020); testy
komponentów React i jsdom (Moduł 3); animacje i tooltipy; licznik na `/teams`
i `/teams/[id]/embark`; responsywność mobilna; migracje, trasy API, nowe zależności.

## Architektura / Podejście

```
TeamComposer  ──  evaluateTeam(composition, pool)
                        │
        violations.length === 0 ?  ── jedna gałąź, dwoje konsumentów
        │                        └─ else: jeden komunikat awaryjny
        ├─ CompetencyRadar   ← evaluation.scores   (radarLayout(COMPETENCIES, …))
        └─ MissingPointsList ← evaluation.missing  (missingCompetencies → COMPETENCIES)
                        │
        CompositionGate  ← evaluation.isValid       (poza gałęzią, nietknięty)
```

Kolejność listy i kolejność osi wykresu wychodzą z **tej samej** stałej `COMPETENCIES`, więc nie
mogą się rozjechać. `CompositionGate` stoi poza gałęzią, bo `isValid` jest odporne na naruszenia
limitu i bramka nie ma prawa zniknąć.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Czysty wybór wierszy | Helper `missingCompetencies` + test wiążący odsiew i kolejność, z dwiema kontrolami mutacyjnymi | Asercja kolejności przez importowaną stałą byłaby tautologią — musi kotwiczyć na literalnej liście siedmiu nazw |
| 2. Lista przy wykresie | `MissingPointsList`, wspólna gałąź `violations`, przeformułowany komunikat awaryjny, domknięcie pytania mapy | Kryterium grepowe zliczające gałąź biegnie po gęsto komentowanym pliku — komentarz nie może powtórzyć wyrażenia w postaci kodu |

**Wymagania wstępne:** S-02 zarchiwizowane (jest); Node 22.14.0 (`nvm use && hash -r`);
`npm run dev` z `.env` i zalogowanym kontem plus jedna zapisana drużyna do weryfikacji ręcznej.
**Szacowany wysiłek:** ~1 sesja w 2 fazach; obie małe, Faza 2 to jeden nowy plik i kilkanaście
linii w wyspie.

## Otwarte ryzyka i założenia

- Założenie: `<>…</>` wewnątrz `<aside className="flex flex-col gap-4">` nie tworzy węzła DOM,
  więc odstęp między wykresem, listą i bramką pozostaje bez zmian. Sprawdzalne wzrokiem
  w kroku ręcznym 2.14.
- Ryzyko: lista pojawiająca się i znikająca przesuwa bramkę w pionie. Przyjęte świadomie —
  alternatywa (stała wysokość z komunikatem sukcesu) powiela tekst bramki.
- Ryzyko: kryterium 2.2 może trafić we własną prozę, jak trzy kryteria w S-06. Domknięte umową:
  komentarz opisuje warunek słowami, nie kodem, a kryterium ma odsiew linii komentarza.
- Założenie: żaden przegląd nie zażąda testu komponentu React — repozytorium nie ma jsdom,
  a strategia testowania to Moduł 3.

## Kryteria sukcesu (podsumowanie)

- Gracz bez znajomości mechaniki widzi na `/teams/new`, których kompetencji brakuje i ilu punktów,
  i obserwuje, jak lista topnieje do zera przy każdym kliknięciu (FR-017).
- Ta sama lista działa przy edycji zapisanej drużyny, a zablokowany przycisk nadal nosi ten sam
  ogólny komunikat co przed zmianą (FR-018 niezależny od FR-017).
- `npm test` dowodzi odsiewu i kolejności wierszy poza przeglądarką, z kontrolą mutacyjną obu
  własności; `git diff` pokazuje zero zmian w domenie, wykresie, bramce, stronach i `package.json`.
