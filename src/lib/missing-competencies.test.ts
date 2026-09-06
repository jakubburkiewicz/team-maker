import { describe, expect, it } from "vitest";

import { COMPETENCIES, type Competency } from "@/lib/domain";
import { missingCompetencies, pointsShortLabel } from "@/lib/missing-competencies";

/**
 * Czy licznik braków nazywa dokładnie te kompetencje, którym brakuje punktów, i robi to
 * w kolejności osi wykresu (FR-017, `## Success Criteria` → Secondary).
 *
 * Nazwy kompetencji i liczby są tu literałami z PRD, nie odczytami ze stałych — asercja wyrażona
 * przez pinowaną stałą podąża za jej mutacją i przestaje cokolwiek wiązać. `COMPETENCIES` służy
 * wyłącznie do **budowania wejść**.
 */

/** Rekord siedmiu braków: podane pozycje, reszta zerami. */
function gaps(overrides: Partial<Record<Competency, number>> = {}): Record<Competency, number> {
  return Object.fromEntries(COMPETENCIES.map((competency) => [competency, overrides[competency] ?? 0])) as Record<
    Competency,
    number
  >;
}

describe("missingCompetencies — wybór wierszy", () => {
  it("domknięty próg we wszystkich kompetencjach nie daje żadnego wiersza", () => {
    expect(missingCompetencies(gaps())).toEqual([]);
  });

  it("pusty skład wypisuje siedem kompetencji po dwa brakujące punkty", () => {
    const rows = missingCompetencies(
      gaps({
        combat: 2,
        hacking: 2,
        stealth: 2,
        engineering: 2,
        medicine: 2,
        negotiation: 2,
        navigation: 2,
      }),
    );

    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.competency)).toEqual([
      "combat",
      "hacking",
      "stealth",
      "engineering",
      "medicine",
      "negotiation",
      "navigation",
    ]);
    for (const row of rows) {
      expect(row.missing).toBe(2);
    }
  });

  it("skład częściowo domknięty wypisuje wyłącznie kompetencje poniżej progu, z ich lukami", () => {
    const rows = missingCompetencies(gaps({ hacking: 1, navigation: 2 }));

    expect(rows).toEqual([
      { competency: "hacking", missing: 1 },
      { competency: "navigation", missing: 2 },
    ]);
  });

  it("kompetencja bez luki i kompetencja z nadmiarem punktów nie trafiają na listę", () => {
    const rows = missingCompetencies(gaps({ combat: 0, hacking: -3, stealth: 1 }));

    expect(rows).toEqual([{ competency: "stealth", missing: 1 }]);
  });
});

describe("missingCompetencies — kolejność i czystość", () => {
  it("kolejność wierszy jest kolejnością osi wykresu, a nie kolejnością wielkości luk", () => {
    // Luki celowo niemonotoniczne względem osi: ani sortowanie rosnące, ani malejące po
    // wielkości luki nie odtwarza tej sekwencji, więc jedna asercja wiąże oba kierunki.
    const rows = missingCompetencies(
      gaps({
        combat: 3,
        hacking: 1,
        stealth: 2,
        engineering: 5,
        medicine: 4,
        negotiation: 7,
        navigation: 6,
      }),
    );

    expect(rows.map((row) => row.competency)).toEqual([
      "combat",
      "hacking",
      "stealth",
      "engineering",
      "medicine",
      "negotiation",
      "navigation",
    ]);
  });

  it("nie mutuje przekazanego rekordu braków", () => {
    const missing = gaps({ combat: 2, navigation: 1 });
    const before = JSON.stringify(missing);

    missingCompetencies(missing);

    expect(JSON.stringify(missing)).toBe(before);
  });
});

describe("pointsShortLabel — liczba gramatyczna", () => {
  it("jeden brakujący punkt czyta się w liczbie pojedynczej", () => {
    expect(pointsShortLabel(1)).toBe("1 point short");
  });

  it("dwa brakujące punkty — pełna luka progu — czytają się w liczbie mnogiej", () => {
    expect(pointsShortLabel(2)).toBe("2 points short");
  });
});
