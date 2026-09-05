import { describe, expect, it } from "vitest";

import { CHARACTER_POOL, addMember, evaluateTeam, removeMember, type TeamComposition } from "@/lib/domain";

/**
 * Limity składu (PRD → FR-012) dowodzone niezależnie od interfejsu. Progi w asercjach są literałami
 * z PRD (`6`), nie stałą `MAX_TEAM_SIZE` — asercja przez pinowaną stałą podąża za jej mutacją
 * i przestaje cokolwiek wiązać (lekcja z F-01).
 *
 * Pula: `CHARACTER_POOL` — czysta stała, dwanaście postaci.
 */

const POOL_IDS = CHARACTER_POOL.map((character) => character.id);

/** Skład z pierwszych `count` postaci puli, budowany wyłącznie przez `addMember`. */
function buildTeam(count: number): TeamComposition {
  let composition: TeamComposition = [];

  for (const characterId of POOL_IDS.slice(0, count)) {
    const result = addMember(composition, characterId, CHARACTER_POOL);
    if (!result.ok) {
      throw new Error(`Unexpected rejection while building a team of ${count}: ${result.reason.kind}`);
    }
    composition = result.composition;
  }

  return composition;
}

describe("addMember", () => {
  it("dodanie do pustego składu daje jednego członka z pustymi perkami i nie mutuje wejścia", () => {
    const empty: TeamComposition = [];
    const result = addMember(empty, POOL_IDS[0], CHARACTER_POOL);

    expect(result).toEqual({ ok: true, composition: [{ characterId: POOL_IDS[0], perkIds: [] }] });
    expect(empty).toEqual([]);
  });

  it("szósty członek wchodzi, siódmy jest odrzucony z team-full i limitem 6, a skład zostaje ten sam", () => {
    const five = buildTeam(5);
    const sixth = addMember(five, POOL_IDS[5], CHARACTER_POOL);

    expect(sixth.ok).toBe(true);
    if (!sixth.ok) return;
    expect(sixth.composition).toHaveLength(6);

    const seventh = addMember(sixth.composition, POOL_IDS[6], CHARACTER_POOL);

    expect(seventh).toEqual({ ok: false, reason: { kind: "team-full", limit: 6 } });
    expect(sixth.composition).toHaveLength(6);
  });

  it("ta sama postać drugi raz jest odrzucona z already-in-team", () => {
    const one = buildTeam(1);

    expect(addMember(one, POOL_IDS[0], CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "already-in-team", characterId: POOL_IDS[0] },
    });
  });

  it("identyfikator spoza puli jest odrzucony z unknown-character", () => {
    expect(addMember([], "ghost", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "unknown-character", characterId: "ghost" },
    });
  });

  it("pełny skład i duplikat naraz dają team-full — pełny skład jest sprawdzany pierwszy", () => {
    const full = buildTeam(6);

    expect(addMember(full, POOL_IDS[0], CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "team-full", limit: 6 },
    });
  });

  it("pełny skład i nieznana postać naraz dają team-full", () => {
    const full = buildTeam(6);

    expect(addMember(full, "ghost", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "team-full", limit: 6 },
    });
  });
});

describe("removeMember", () => {
  it("usuwa wskazaną postać i zachowuje kolejność pozostałych", () => {
    const three = buildTeam(3);
    const [first, second, third] = POOL_IDS;

    const result = removeMember(three, second);

    expect(result.map((member) => member.characterId)).toEqual([first, third]);
    expect(three).toHaveLength(3);
  });

  it("dla nieobecnej postaci zwraca tę samą referencję", () => {
    const three = buildTeam(3);

    expect(removeMember(three, "ghost")).toBe(three);
    expect(removeMember([], "vesper")).toEqual([]);
  });

  it("usunięta postać może wrócić do składu przez addMember", () => {
    const three = buildTeam(3);
    const without = removeMember(three, POOL_IDS[0]);
    const back = addMember(without, POOL_IDS[0], CHARACTER_POOL);

    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.composition.map((member) => member.characterId)).toEqual([POOL_IDS[1], POOL_IDS[2], POOL_IDS[0]]);
  });
});

describe("zgodność z evaluateTeam", () => {
  it("skład budowany wyłącznie przez addMember nigdy nie łamie limitów składu — dwanaście prób po kolei", () => {
    let composition: TeamComposition = [];
    let accepted = 0;

    for (const characterId of POOL_IDS) {
      const result = addMember(composition, characterId, CHARACTER_POOL);
      if (result.ok) {
        composition = result.composition;
        accepted += 1;
      }

      const evaluation = evaluateTeam(composition, CHARACTER_POOL);
      const limitViolations = evaluation.violations.filter(
        (violation) => violation.kind === "too-many-members" || violation.kind === "duplicate-character",
      );
      expect(limitViolations).toEqual([]);
    }

    expect(accepted).toBe(6);
    expect(composition).toHaveLength(6);
  });

  it("odrzucenie team-full odpowiada naruszeniu too-many-members po doklejeniu na siłę", () => {
    const full = buildTeam(6);
    const rejected = addMember(full, POOL_IDS[6], CHARACTER_POOL);

    expect(rejected).toEqual({ ok: false, reason: { kind: "team-full", limit: 6 } });

    const forced: TeamComposition = [...full, { characterId: POOL_IDS[6], perkIds: [] }];
    const evaluation = evaluateTeam(forced, CHARACTER_POOL);

    expect(evaluation.violations).toContainEqual({ kind: "too-many-members", count: 7 });
    expect(evaluation.isValid).toBe(false);
  });

  it("odrzucenie already-in-team odpowiada naruszeniu duplicate-character po doklejeniu na siłę", () => {
    const three = buildTeam(3);
    const duplicateId = POOL_IDS[1];
    const rejected = addMember(three, duplicateId, CHARACTER_POOL);

    expect(rejected).toEqual({ ok: false, reason: { kind: "already-in-team", characterId: duplicateId } });

    const forced: TeamComposition = [...three, { characterId: duplicateId, perkIds: [] }];
    const evaluation = evaluateTeam(forced, CHARACTER_POOL);

    expect(evaluation.violations).toContainEqual({ kind: "duplicate-character", characterId: duplicateId });
    expect(evaluation.isValid).toBe(false);
  });

  it("odrzucenie unknown-character odpowiada naruszeniu unknown-character po doklejeniu na siłę", () => {
    const three = buildTeam(3);
    const rejected = addMember(three, "ghost", CHARACTER_POOL);

    expect(rejected).toEqual({ ok: false, reason: { kind: "unknown-character", characterId: "ghost" } });

    const forced: TeamComposition = [...three, { characterId: "ghost", perkIds: [] }];
    const evaluation = evaluateTeam(forced, CHARACTER_POOL);

    expect(evaluation.violations).toContainEqual({ kind: "unknown-character", characterId: "ghost" });
  });
});
