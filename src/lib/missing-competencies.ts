import { COMPETENCIES, type Competency } from "@/lib/domain";

/** Jeden wiersz licznika: kompetencja poniżej progu i liczba brakujących jej punktów. */
export interface MissingRow {
  competency: Competency;
  missing: number;
}

/**
 * Wybór i kolejność wierszy licznika brakujących punktów (FR-017).
 *
 * Moduł nie liczy braków — te przychodzą gotowe z `evaluateTeam`. Rozstrzyga wyłącznie, **które**
 * kompetencje trafiają na listę i **w jakiej kolejności**, czyli decyzje prezentacyjne. Dlatego
 * mieszka w `src/lib/` obok `radar-geometry.ts`, a nie w `src/lib/domain/`: ta sama granica dzieli
 * geometrię wykresu od reguły, którą wykres rysuje.
 *
 * Wejściem jest `missing` z `TeamEvaluation`, czytane — jak `scores` — wyłącznie przy pustym
 * `violations` (umowa `evaluate-team.ts`). Egzekwuje ją wywołujący, w jednej gałęzi wspólnej
 * z wykresem.
 */

/**
 * Kompetencje poniżej progu, w kolejności osi wykresu.
 *
 * Kolejność bierze się z `COMPETENCIES` — tej samej tablicy, którą `CompetencyRadar` podaje do
 * `radarLayout`, więc lista i osie nie mogą się rozjechać. Nie sortuje po wielkości luki: wiersze
 * przeskakiwałyby przy każdym kliknięciu perka. Funkcja jest czysta i nie mutuje wejścia.
 */
export function missingCompetencies(missing: Readonly<Record<Competency, number>>): readonly MissingRow[] {
  return COMPETENCIES.filter((competency) => missing[competency] > 0).map((competency) => ({
    competency,
    missing: missing[competency],
  }));
}

/**
 * Napis wiersza z poprawną liczbą gramatyczną: „1 point short", „2 points short".
 *
 * Mieszka tu, a nie w komponencie, bo to jedyna reguła tego fragmentu, która inaczej zostałaby bez
 * dowodu w CI — testów komponentów React w tym repozytorium nie ma. Precedens na napis interfejsu
 * w `src/lib/`: `BELOW_THRESHOLD_MESSAGE` w `team-submission.ts`.
 */
export function pointsShortLabel(missing: number): string {
  return missing === 1 ? "1 point short" : `${missing} points short`;
}
