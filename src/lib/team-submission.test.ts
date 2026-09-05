import { describe, expect, it } from "vitest";

import { CHARACTER_POOL, addMember, evaluateTeam, togglePerk, type TeamComposition } from "@/lib/domain";
import { findThresholdSolution } from "@/lib/domain/solvability";
import { COMPOSITION_FIELD, gateTeamSubmission, parseTeamComposition } from "@/lib/team-submission";

/**
 * Dowód Guardraila „zapisana drużyna zawsze spełnia próg — reguła obowiązuje także poza
 * interfejsem": bramka serwerowa przepuszcza wyłącznie składy z `isValid` i odrzuca każdy inny
 * kształt wejścia. Progi i limity w asercjach są literałami z PRD (`6`, `2`), identyfikatory
 * z `CHARACTER_POOL`, nie literały (uwaga F3 z przeglądu S-01).
 */

const POOL_IDS = CHARACTER_POOL.map((character) => character.id);

function perkIdsOf(characterId: string): readonly string[] {
  const character = CHARACTER_POOL.find((candidate) => candidate.id === characterId);
  if (character === undefined) throw new Error(`Character ${characterId} missing from pool`);
  return character.perks.map((perk) => perk.id);
}

/** Skład domykający próg z solvera — rzuca, gdy pula jest nierozwiązywalna (to sprawdza F-02). */
function solvedComposition(): TeamComposition {
  const solution = findThresholdSolution(CHARACTER_POOL);
  if (solution === null) throw new Error("CHARACTER_POOL has no threshold solution");
  return solution;
}

/** Skład zbudowany wyłącznie przez pisarzy z `roster.ts`: dwie postacie, jedna z dwoma perkami. */
function rosterBuiltComposition(): TeamComposition {
  const first = addMember([], POOL_IDS[0], CHARACTER_POOL);
  if (!first.ok) throw new Error(first.reason.kind);
  const second = addMember(first.composition, POOL_IDS[1], CHARACTER_POOL);
  if (!second.ok) throw new Error(second.reason.kind);

  let composition = second.composition;
  for (const perkId of perkIdsOf(POOL_IDS[1]).slice(0, 2)) {
    const toggled = togglePerk(composition, POOL_IDS[1], perkId, CHARACTER_POOL);
    if (!toggled.ok) throw new Error(toggled.reason.kind);
    composition = toggled.composition;
  }

  return composition;
}

describe("COMPOSITION_FIELD", () => {
  it("jest stałym literałem nazwy pola — obie strony formularza dzielą go przez import", () => {
    expect(COMPOSITION_FIELD).toBe("composition");
  });
});

describe("parseTeamComposition", () => {
  it("round-trip przez JSON.stringify składu zbudowanego przez addMember + togglePerk daje równy skład", () => {
    const composition = rosterBuiltComposition();

    expect(parseTeamComposition(JSON.stringify(composition))).toEqual(composition);
  });

  it("pusta tablica daje pusty skład", () => {
    expect(parseTeamComposition("[]")).toEqual([]);
  });

  it.each([
    ["nie-JSON", "not json"],
    ["obiekt zamiast tablicy", "{}"],
    ["element nie-obiekt", "[1]"],
    ["element null", "[null]"],
    ["element bez perkIds", JSON.stringify([{ characterId: POOL_IDS[0] }])],
    ["perkIds z liczbą", JSON.stringify([{ characterId: POOL_IDS[0], perkIds: [1] }])],
    ["perkIds nie-tablica", JSON.stringify([{ characterId: POOL_IDS[0], perkIds: "x" }])],
    ["characterId liczbowe", JSON.stringify([{ characterId: 1, perkIds: [] }])],
  ])("%s → null", (_label, raw) => {
    expect(parseTeamComposition(raw)).toBeNull();
  });

  it("nadmiarowe pole znika z wyniku — do bazy idzie wyłącznie characterId i perkIds", () => {
    const raw = JSON.stringify([{ characterId: POOL_IDS[0], perkIds: [], name: "x" }]);

    expect(parseTeamComposition(raw)).toEqual([{ characterId: POOL_IDS[0], perkIds: [] }]);
  });

  it("nie sprawdza limitów ani puli — siedmiu nieznanych członków przechodzi przez parser", () => {
    const raw = JSON.stringify(
      Array.from({ length: 7 }, (_, index) => ({ characterId: `ghost-${index}`, perkIds: [] })),
    );

    expect(parseTeamComposition(raw)).toHaveLength(7);
  });
});

describe("gateTeamSubmission", () => {
  it("skład z solvera przechodzi jako ok, a isValid potwierdza niezależnie evaluateTeam", () => {
    const solution = solvedComposition();

    const result = gateTeamSubmission(JSON.stringify(solution), CHARACTER_POOL);

    expect(result).toEqual({ ok: true, composition: solution });
    expect(evaluateTeam(solution, CHARACTER_POOL).isValid).toBe(true);
  });

  it("sześć postaci bez perków nie domyka progu — perki są konieczne (PRD → Business Logic)", () => {
    const composition = POOL_IDS.slice(0, 6).map((characterId) => ({ characterId, perkIds: [] }));

    expect(gateTeamSubmission(JSON.stringify(composition), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("siódmy członek doklejony na siłę do domkniętego składu → below-threshold", () => {
    const solution = solvedComposition();
    const taken = new Set(solution.map((member) => member.characterId));
    const spare = POOL_IDS.filter((id) => !taken.has(id));
    const forced: TeamComposition = [
      ...solution,
      ...spare.slice(0, 7 - solution.length).map((characterId) => ({ characterId, perkIds: [] })),
    ];

    expect(forced).toHaveLength(7);
    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("trzeci perk doklejony na siłę do domkniętego składu → below-threshold", () => {
    const [first, ...rest] = solvedComposition();
    const forced: TeamComposition = [
      { characterId: first.characterId, perkIds: perkIdsOf(first.characterId) },
      ...rest,
    ];

    expect(forced[0].perkIds).toHaveLength(3);
    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("characterId spoza puli → below-threshold", () => {
    const [first, ...rest] = solvedComposition();
    const forced: TeamComposition = [{ characterId: "ghost", perkIds: first.perkIds }, ...rest];

    expect(gateTeamSubmission(JSON.stringify(forced), CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("nie-JSON → invalid-payload", () => {
    expect(gateTeamSubmission("not json", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "invalid-payload" },
    });
  });

  it("pusta tablica → below-threshold", () => {
    expect(gateTeamSubmission("[]", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "below-threshold" },
    });
  });

  it("wynik ok niesie skład po parserze — bez nadmiarowych pól", () => {
    const solution = solvedComposition();
    const raw = JSON.stringify(solution.map((member) => ({ ...member, note: "drop me" })));

    const result = gateTeamSubmission(raw, CHARACTER_POOL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.composition).toEqual(solution);
    for (const member of result.composition) {
      expect(member).not.toHaveProperty("note");
    }
  });
});
