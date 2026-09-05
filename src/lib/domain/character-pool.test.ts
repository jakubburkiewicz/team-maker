import { describe, expect, it } from "vitest";

import { CHARACTER_POOL, COMPETENCIES, evaluateTeam, type CharacterPool, type TeamComposition } from "@/lib/domain";
import { countThresholdSolutions, findThresholdSolution } from "@/lib/domain/solvability";

/**
 * Zestaw wiąże oba warunki, które PRD nazywa wiążącymi: kształt puli i jej rozwiązywalność.
 *
 * Liczności i limity są tu literałami z PRD (12 postaci, 3 perki, 6 członków, próg 2), nie stałymi
 * z modułu — asercja wyrażona przez pinowaną stałą podąża za jej mutacją i przestaje cokolwiek
 * wiązać (ustalenie F2 przeglądu F-01).
 */

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Wszystkie k-elementowe podzbiory, w kolejności rosnących indeksów. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [head, ...rest] = items;
  const withHead = combinations(rest, size - 1).map((tail) => [head, ...tail]);

  return [...withHead, ...combinations(rest, size)];
}

describe("pula postaci — kształt", () => {
  it("ma dokładnie dwanaście postaci", () => {
    expect(CHARACTER_POOL).toHaveLength(12);
  });

  it("każda postać ma dokładnie trzy perki", () => {
    for (const character of CHARACTER_POOL) {
      expect(character.perks, character.id).toHaveLength(3);
    }
  });

  it("identyfikatory postaci są unikalne i w kebab-case", () => {
    const ids = CHARACTER_POOL.map((character) => character.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(KEBAB_CASE);
    }
  });

  it("identyfikatory perków są unikalne globalnie w całej puli i w kebab-case", () => {
    const ids = CHARACTER_POOL.flatMap((character) => character.perks.map((perk) => perk.id));

    expect(ids).toHaveLength(12 * 3);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(KEBAB_CASE);
    }
  });

  it("każda z siedmiu kompetencji jest specjalizacją co najmniej jednej postaci", () => {
    const specializations = new Set(CHARACTER_POOL.map((character) => character.specialization));

    for (const competency of COMPETENCIES) {
      expect(specializations.has(competency), competency).toBe(true);
    }
  });

  it("każda postać i każdy perk niosą niepustą treść", () => {
    for (const character of CHARACTER_POOL) {
      expect(character.name.trim(), character.id).not.toBe("");
      expect(character.description.trim(), character.id).not.toBe("");
      for (const perk of character.perks) {
        expect(perk.name.trim(), perk.id).not.toBe("");
      }
    }
  });
});

describe("pula postaci — rozwiązywalność", () => {
  it("istnieje skład domykający próg, a evaluateTeam potwierdza go niezależnie od solvera", () => {
    const composition = findThresholdSolution(CHARACTER_POOL);

    expect(composition).not.toBeNull();
    if (composition === null) return;

    // Solver nie jest jedynym świadkiem: werdykt wydaje reguła, nie przeszukiwanie.
    const result = evaluateTeam(composition, CHARACTER_POOL);

    expect(result.violations).toEqual([]);
    for (const competency of COMPETENCIES) {
      expect(result.scores[competency]).toBeGreaterThanOrEqual(2);
    }
    expect(result.isValid).toBe(true);
  });

  it("solver zwraca null dla puli, w której jedna kompetencja nie występuje ani w specjalizacji, ani w perkach", () => {
    // Bez tego przypadku solver zwracający zawsze `null` przechodziłby połowę zestawu.
    const unsolvable: CharacterPool = CHARACTER_POOL.map((character) => ({
      id: character.id,
      specialization: character.specialization === "navigation" ? "combat" : character.specialization,
      perks: character.perks.map((perk) => ({
        id: perk.id,
        competency: perk.competency === "navigation" ? "combat" : perk.competency,
      })),
    }));

    expect(findThresholdSolution(unsolvable)).toBeNull();
  });

  it("żaden skład sześciu postaci bez perków nie domyka progu — sześć specjalizacji na siedem kompetencji", () => {
    // Ten przypadek jest prawdziwy dla DOWOLNEJ puli, więc nie waliduje treści `CHARACTER_POOL`.
    // Dokumentuje na danych docelowych zapis PRD → Business Logic: „perki muszą zostać użyte
    // w każdym poprawnym rozwiązaniu".
    const sixMemberSubsets = combinations(CHARACTER_POOL, 6);
    expect(sixMemberSubsets.length).toBeGreaterThan(0);

    for (const subset of sixMemberSubsets) {
      const composition: TeamComposition = subset.map((character) => ({ characterId: character.id, perkIds: [] }));
      const result = evaluateTeam(composition, CHARACTER_POOL);

      expect(result.violations).toEqual([]);
      expect(result.isValid).toBe(false);
    }
  });

  it("pula jest komfortowo rozwiązywalna — liczba domykających par przekracza dolny próg", () => {
    // Próg, nie równość: edycja treści, która niczego nie łamie, nie czerwieni zestawu, a realny
    // spadek rozwiązywalności tak. Pomiar bazowy 2026-09-05: 16 329 329 par (podzbiór postaci,
    // przypisanie perków); usunięcie dowolnej pojedynczej postaci spada do 5,7–9,2 mln.
    expect(countThresholdSolutions(CHARACTER_POOL)).toBeGreaterThan(10_000_000);
  });
});
