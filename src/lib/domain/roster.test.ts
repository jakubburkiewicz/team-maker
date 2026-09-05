import { describe, expect, it } from "vitest";

import {
  CHARACTER_POOL,
  COMPETENCIES,
  addMember,
  evaluateTeam,
  removeMember,
  togglePerk,
  type Competency,
  type TeamComposition,
} from "@/lib/domain";
import { findThresholdSolution } from "@/lib/domain/solvability";

/**
 * Limity składu (PRD → FR-012, FR-014) dowodzone niezależnie od interfejsu. Progi w asercjach są
 * literałami z PRD (`6`, `2`), nie stałymi `MAX_TEAM_SIZE` / `MAX_PERKS_PER_MEMBER` — asercja przez
 * pinowaną stałą podąża za jej mutacją i przestaje cokolwiek wiązać (lekcja z F-01).
 *
 * Pula: `CHARACTER_POOL` — czysta stała, dwanaście postaci. Identyfikatory zawsze z `POOL_IDS` /
 * `CHARACTER_POOL`, nie literały (uwaga F3 z przeglądu S-01).
 */

const POOL_IDS = CHARACTER_POOL.map((character) => character.id);

/** Identyfikatory trzech perków postaci o danym indeksie w puli. */
function perkIdsOf(characterIndex: number): readonly string[] {
  return CHARACTER_POOL[characterIndex].perks.map((perk) => perk.id);
}

/** `togglePerk`, które musi się udać — rzuca przy odrzuceniu, żeby test nie przechodził po cichu. */
function mustToggle(composition: TeamComposition, characterId: string, perkId: string): TeamComposition {
  const result = togglePerk(composition, characterId, perkId, CHARACTER_POOL);
  if (!result.ok) {
    throw new Error(`Unexpected rejection while toggling ${perkId} on ${characterId}: ${result.reason.kind}`);
  }
  return result.composition;
}

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

describe("togglePerk", () => {
  it("zaznaczenie dokłada perk do właściwego członka, pozostali zachowują referencje, wejście nie jest mutowane", () => {
    const three = buildTeam(3);
    const [perkId] = perkIdsOf(1);

    const result = togglePerk(three, POOL_IDS[1], perkId, CHARACTER_POOL);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.composition).toHaveLength(3);
    expect(result.composition[1]).toEqual({ characterId: POOL_IDS[1], perkIds: [perkId] });
    expect(result.composition[0]).toBe(three[0]);
    expect(result.composition[2]).toBe(three[2]);
    expect(three[1].perkIds).toEqual([]);
  });

  it("ponowne przełączenie tego samego perka odznacza go", () => {
    const one = buildTeam(1);
    const [perkId] = perkIdsOf(0);

    const selected = mustToggle(one, POOL_IDS[0], perkId);
    const deselected = mustToggle(selected, POOL_IDS[0], perkId);

    expect(deselected).toEqual([{ characterId: POOL_IDS[0], perkIds: [] }]);
    expect(selected[0].perkIds).toEqual([perkId]);
  });

  it("drugi perk wchodzi, trzeci jest odrzucony z perk-limit i limitem 2, a skład zostaje ten sam", () => {
    const one = buildTeam(1);
    const [first, second, third] = perkIdsOf(0);

    const withTwo = mustToggle(mustToggle(one, POOL_IDS[0], first), POOL_IDS[0], second);
    expect(withTwo[0].perkIds).toEqual([first, second]);

    const rejected = togglePerk(withTwo, POOL_IDS[0], third, CHARACTER_POOL);

    expect(rejected).toEqual({ ok: false, reason: { kind: "perk-limit", characterId: POOL_IDS[0], limit: 2 } });
    expect(withTwo[0].perkIds).toEqual([first, second]);
  });

  it("po odznaczeniu jednego z dwóch trzeci może wejść", () => {
    const one = buildTeam(1);
    const [first, second, third] = perkIdsOf(0);

    const withTwo = mustToggle(mustToggle(one, POOL_IDS[0], first), POOL_IDS[0], second);
    const withOne = mustToggle(withTwo, POOL_IDS[0], first);
    const swapped = mustToggle(withOne, POOL_IDS[0], third);

    expect(swapped[0].perkIds).toEqual([second, third]);
  });

  it("perk innej postaci z puli jest odrzucony z unknown-perk", () => {
    const one = buildTeam(1);
    const [foreignPerk] = perkIdsOf(1);

    expect(togglePerk(one, POOL_IDS[0], foreignPerk, CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "unknown-perk", characterId: POOL_IDS[0], perkId: foreignPerk },
    });
  });

  it("nieistniejący identyfikator perka jest odrzucony z unknown-perk", () => {
    const one = buildTeam(1);

    expect(togglePerk(one, POOL_IDS[0], "ghost-perk", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "unknown-perk", characterId: POOL_IDS[0], perkId: "ghost-perk" },
    });
  });

  it("członek doklejony na siłę z characterId spoza puli daje unknown-perk", () => {
    const forced: TeamComposition = [{ characterId: "ghost", perkIds: [] }];

    expect(togglePerk(forced, "ghost", "ghost-perk", CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "unknown-perk", characterId: "ghost", perkId: "ghost-perk" },
    });
  });

  it("postać spoza składu jest odrzucona z member-not-in-team, także gdy jest w puli", () => {
    const one = buildTeam(1);
    const [perkId] = perkIdsOf(1);

    expect(togglePerk(one, POOL_IDS[1], perkId, CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "member-not-in-team", characterId: POOL_IDS[1] },
    });
    expect(togglePerk([], POOL_IDS[0], perkIdsOf(0)[0], CHARACTER_POOL)).toEqual({
      ok: false,
      reason: { kind: "member-not-in-team", characterId: POOL_IDS[0] },
    });
  });

  it("kolejność perkIds jest kolejnością wyboru, nie kolejnością w puli", () => {
    const one = buildTeam(1);
    const [first, , third] = perkIdsOf(0);

    const composition = mustToggle(mustToggle(one, POOL_IDS[0], third), POOL_IDS[0], first);

    expect(composition[0].perkIds).toEqual([third, first]);
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

  it("skład budowany wyłącznie przez addMember + togglePerk ma zero naruszeń, a sumy to 2 × specjalizacje + 1 × perki", () => {
    let composition = buildTeam(6);

    // Każdemu z sześciu członków próbujemy zaznaczyć wszystkie trzy perki po kolei — trzeci odpada.
    for (const [index, characterId] of POOL_IDS.slice(0, 6).entries()) {
      for (const perkId of perkIdsOf(index)) {
        const result = togglePerk(composition, characterId, perkId, CHARACTER_POOL);
        if (result.ok) composition = result.composition;
      }
    }

    for (const member of composition) {
      expect(member.perkIds).toHaveLength(2);
    }

    const evaluation = evaluateTeam(composition, CHARACTER_POOL);
    expect(evaluation.violations).toEqual([]);

    const expected = Object.fromEntries(COMPETENCIES.map((competency) => [competency, 0])) as Record<
      Competency,
      number
    >;
    for (const member of composition) {
      const character = CHARACTER_POOL.find((candidate) => candidate.id === member.characterId);
      if (character === undefined) throw new Error(`Character ${member.characterId} missing from pool`);
      expected[character.specialization] += 2;
      for (const perkId of member.perkIds) {
        const perk = character.perks.find((candidate) => candidate.id === perkId);
        if (perk === undefined) throw new Error(`Perk ${perkId} missing on ${character.id}`);
        expected[perk.competency] += 1;
      }
    }
    expect(evaluation.scores).toEqual(expected);
  });

  it("odrzucenie perk-limit odpowiada naruszeniu too-many-perks po doklejeniu na siłę", () => {
    const one = buildTeam(1);
    const [first, second, third] = perkIdsOf(0);
    const withTwo = mustToggle(mustToggle(one, POOL_IDS[0], first), POOL_IDS[0], second);

    const rejected = togglePerk(withTwo, POOL_IDS[0], third, CHARACTER_POOL);
    expect(rejected).toEqual({ ok: false, reason: { kind: "perk-limit", characterId: POOL_IDS[0], limit: 2 } });

    const forced: TeamComposition = [{ characterId: POOL_IDS[0], perkIds: [first, second, third] }];
    const evaluation = evaluateTeam(forced, CHARACTER_POOL);

    expect(evaluation.violations).toContainEqual({ kind: "too-many-perks", characterId: POOL_IDS[0], count: 3 });
    expect(evaluation.isValid).toBe(false);
  });

  it("odrzucenie unknown-perk odpowiada naruszeniu unknown-perk po doklejeniu na siłę", () => {
    const one = buildTeam(1);
    const [foreignPerk] = perkIdsOf(1);

    const rejected = togglePerk(one, POOL_IDS[0], foreignPerk, CHARACTER_POOL);
    expect(rejected).toEqual({
      ok: false,
      reason: { kind: "unknown-perk", characterId: POOL_IDS[0], perkId: foreignPerk },
    });

    const forced: TeamComposition = [{ characterId: POOL_IDS[0], perkIds: [foreignPerk] }];
    const evaluation = evaluateTeam(forced, CHARACTER_POOL);

    expect(evaluation.violations).toContainEqual({
      kind: "unknown-perk",
      characterId: POOL_IDS[0],
      perkId: foreignPerk,
    });
    expect(evaluation.isValid).toBe(false);
  });

  it("próg jest osiągalny wyłącznie przez pisarzy: skład z solvera odtworzony przez addMember + togglePerk daje isValid", () => {
    const solution = findThresholdSolution(CHARACTER_POOL);

    expect(solution).not.toBeNull();
    if (solution === null) return;

    let composition: TeamComposition = [];
    for (const member of solution) {
      const added = addMember(composition, member.characterId, CHARACTER_POOL);
      if (!added.ok) throw new Error(`Unexpected rejection adding ${member.characterId}: ${added.reason.kind}`);
      composition = added.composition;
      for (const perkId of member.perkIds) {
        composition = mustToggle(composition, member.characterId, perkId);
      }
    }

    const evaluation = evaluateTeam(composition, CHARACTER_POOL);

    expect(evaluation.violations).toEqual([]);
    expect(evaluation.isValid).toBe(true);
  });
});
