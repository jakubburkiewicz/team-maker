import { describe, expect, it } from "vitest";

import {
  COMPETENCIES,
  MAX_TEAM_SIZE,
  PERKS_PER_CHARACTER,
  evaluateTeam,
  type Competency,
  type TeamComposition,
} from "@/lib/domain";
import { TEST_POOL, member, onePointShortComposition, thresholdClosingComposition } from "@/lib/domain/test-fixtures";

/**
 * Czy każda z siedmiu kompetencji stoi co najmniej na progu.
 *
 * Próg jest tu literałem z PRD (FR-018), nie stałą `COMPETENCY_THRESHOLD` — asercja wyrażona
 * przez pinowaną stałą podąża za jej mutacją i przestaje cokolwiek wiązać.
 */
function everyCompetencyAtThreshold(scores: Record<Competency, number>): boolean {
  return COMPETENCIES.every((competency) => scores[competency] >= 2);
}

/** Wszystkie k-elementowe podzbiory, w kolejności rosnących indeksów. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];

  const [head, ...rest] = items;
  const withHead = combinations(rest, size - 1).map((tail) => [head, ...tail]);

  return [...withHead, ...combinations(rest, size)];
}

describe("pula postaci", () => {
  it("każda postać ma dokładnie PERKS_PER_CHARACTER perków o unikalnych identyfikatorach", () => {
    for (const character of TEST_POOL) {
      expect(character.perks).toHaveLength(PERKS_PER_CHARACTER);
      expect(new Set(character.perks.map((perk) => perk.id)).size).toBe(PERKS_PER_CHARACTER);
    }
  });
});

describe("evaluateTeam — punktacja i próg", () => {
  it("pusty skład ma zerowe sumy, pełne braki i negatywny werdykt bez naruszeń", () => {
    const result = evaluateTeam([], TEST_POOL);

    for (const competency of COMPETENCIES) {
      expect(result.scores[competency]).toBe(0);
      expect(result.missing[competency]).toBe(2);
    }
    expect(result.violations).toEqual([]);
    expect(result.isValid).toBe(false);
  });

  it("specjalizacja wnosi 2 punkty, perk 1 — a sumy kumulują się z wielu źródeł bez przycinania", () => {
    const result = evaluateTeam(
      [member("rook"), member("ash"), member("mote", "mote-combat"), member("broker", "broker-combat")],
      TEST_POOL,
    );

    // combat: dwie specjalizacje (2 + 2) plus dwa perki (1 + 1)
    expect(result.scores.combat).toBe(6);
    expect(result.scores.stealth).toBe(2);
    expect(result.scores.negotiation).toBe(2);
    expect(result.missing.combat).toBe(0);
  });

  it("skład domykający próg nie ma braków i dostaje pozytywny werdykt", () => {
    const result = evaluateTeam(thresholdClosingComposition(), TEST_POOL);

    for (const competency of COMPETENCIES) {
      expect(result.missing[competency]).toBe(0);
    }
    expect(result.violations).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it("skład o dokładnie jeden punkt za krótki wskazuje tę jedną kompetencję", () => {
    const result = evaluateTeam(onePointShortComposition(), TEST_POOL);

    expect(result.scores.navigation).toBe(1);
    expect(result.missing.navigation).toBe(1);
    for (const competency of COMPETENCIES.filter((candidate) => candidate !== "navigation")) {
      expect(result.missing[competency]).toBe(0);
    }
    expect(result.isValid).toBe(false);
  });

  it("żaden skład sześciu postaci bez perków nie domyka progu — sześć specjalizacji na siedem kompetencji", () => {
    const sixMemberSubsets = combinations(TEST_POOL, MAX_TEAM_SIZE);
    expect(sixMemberSubsets.length).toBeGreaterThan(0);

    for (const subset of sixMemberSubsets) {
      const composition: TeamComposition = subset.map((character) => member(character.id));
      const result = evaluateTeam(composition, TEST_POOL);

      expect(result.violations).toEqual([]);
      expect(result.isValid).toBe(false);
    }
  });
});

describe("evaluateTeam — limity składu", () => {
  it("siedmiu członków łamie limit mimo domkniętych sum", () => {
    const result = evaluateTeam([...thresholdClosingComposition(), member("drift")], TEST_POOL);

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "too-many-members", count: 7 });
    expect(result.isValid).toBe(false);
  });

  it("ta sama postać dwukrotnie łamie limit mimo domkniętych sum", () => {
    const result = evaluateTeam(
      [
        member("rook"),
        member("wire"),
        member("mote", "mote-neg", "mote-nav"),
        member("cog"),
        member("salve", "salve-neg", "salve-nav"),
        member("salve"),
      ],
      TEST_POOL,
    );

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "duplicate-character", characterId: "salve" });
    expect(result.isValid).toBe(false);
  });

  it("ten sam perk dwukrotnie domyka sumy, ale łamie limit — powtórzenie nie zastępuje drugiego perka", () => {
    const [, ...rest] = onePointShortComposition();
    const result = evaluateTeam([member("rook", "rook-nav", "rook-nav"), ...rest], TEST_POOL);

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "duplicate-perk", characterId: "rook", perkId: "rook-nav" });
    expect(result.isValid).toBe(false);
  });

  it("trzy perki u jednego członka łamią limit mimo domkniętych sum", () => {
    const [, ...rest] = thresholdClosingComposition();
    const result = evaluateTeam([member("rook", "rook-nav", "rook-med", "rook-hack"), ...rest], TEST_POOL);

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "too-many-perks", characterId: "rook", count: 3 });
    expect(result.isValid).toBe(false);
  });

  it("perk nienależący do wybranej postaci jest odrzucany mimo domkniętych sum", () => {
    const composition = thresholdClosingComposition().map((selection) =>
      selection.characterId === "mote" ? member("mote", "rook-nav") : selection,
    );
    const result = evaluateTeam(composition, TEST_POOL);

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "unknown-perk", characterId: "mote", perkId: "rook-nav" });
    expect(result.isValid).toBe(false);
  });

  it("postać spoza puli nie wnosi punktów i unieważnia skład mimo domkniętych sum", () => {
    const result = evaluateTeam(
      [
        member("rook"),
        member("wire"),
        member("mote", "mote-neg", "mote-nav"),
        member("cog"),
        member("salve", "salve-neg", "salve-nav"),
        member("ghost"),
      ],
      TEST_POOL,
    );

    expect(everyCompetencyAtThreshold(result.scores)).toBe(true);
    expect(result.violations).toContainEqual({ kind: "unknown-character", characterId: "ghost" });
    expect(result.isValid).toBe(false);
  });
});

describe("evaluateTeam — czystość", () => {
  it("nie mutuje przekazanego składu ani puli", () => {
    const composition = thresholdClosingComposition();
    const compositionBefore = JSON.stringify(composition);
    const poolBefore = JSON.stringify(TEST_POOL);

    evaluateTeam(composition, TEST_POOL);

    expect(JSON.stringify(composition)).toBe(compositionBefore);
    expect(JSON.stringify(TEST_POOL)).toBe(poolBefore);
  });
});
