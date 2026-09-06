import { type Competency } from "@/lib/domain";
import { missingCompetencies, pointsShortLabel } from "@/lib/missing-competencies";

interface MissingPointsListProps {
  /**
   * Braki z `evaluateTeam` — czytane, tak jak `scores`, wyłącznie przy pustym `violations`
   * (umowa `evaluate-team.ts`). Komponent dostaje sam rekord braków, a nie całe `TeamEvaluation`:
   * nie ma prawa czytać niczego więcej.
   */
  missing: Readonly<Record<Competency, number>>;
}

/**
 * Lista kompetencji poniżej progu wraz z liczbą brakujących punktów (FR-017).
 *
 * Nazywa luki, które wykres pokazuje tylko kształtem — czytelność łamigłówki dla persony
 * recenzenta wchodzącej bez tutoriala. Bezstanowy, bez efektów: wybór wierszy, ich kolejność
 * i liczba gramatyczna etykiety przychodzą z `missing-competencies.ts`, gdzie mają dowód
 * w `npm test`, a nie w oglądaniu ekranu.
 *
 * Po domknięciu progu znika w całości: bramka mówi wtedy „All seven competencies are covered."
 * i drugi komunikat sukcesu byłby duplikatem.
 */
export function MissingPointsList({ missing }: MissingPointsListProps) {
  const rows = missingCompetencies(missing);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold text-blue-100/80">Below threshold</p>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li key={row.competency} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="tracking-wide text-purple-300 uppercase">{row.competency}</span>
            <span className="shrink-0 text-blue-100/60">{pointsShortLabel(row.missing)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
