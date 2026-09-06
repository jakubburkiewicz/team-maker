import { describe, expect, it } from "vitest";

import { TEST_POOL, member, thresholdClosingComposition } from "@/lib/domain/test-fixtures";
import { MAX_TEAM_SIZE, type RuleViolation } from "@/lib/domain";
import { resolveSavedTeam, type SavedTeamResolution } from "@/lib/team-view";

/**
 * Dowód, że odmowa działa dokładnie tam, gdzie ma — `resolveSavedTeam` jest jedyną barierą między
 * rozjechanym rekordem w bazie a ekranem pokazującym skład inny niż zapisany.
 *
 * Identyfikatory są brane z `TEST_POOL`, nie wpisywane literałami (uwaga F3 z przeglądu S-01):
 * literał przestałby być „spoza puli" w chwili, w której ktoś dopisze do fixture'u postać o tej
 * nazwie, i test przestałby testować cokolwiek, nie czerwieniąc się.
 */

const POOL_IDS = TEST_POOL.map((character) => character.id);

/** Identyfikator, którego pula nie może zawierać — zbudowany z jej własnych, więc rośnie razem z nią. */
const ABSENT_ID = `${POOL_IDS.join("+")}-absent`;

/** Zawęża wynik do odmowy — asercja na samym `ok` nie dałaby dostępu do `violations`. */
function violationsOf(result: SavedTeamResolution): readonly RuleViolation[] {
  if (result.ok) throw new Error("Expected resolveSavedTeam to reject the composition");
  return result.violations;
}

describe("resolveSavedTeam", () => {
  it("skład złożony w całości z puli przechodzi i wraca nietknięty", () => {
    const composition = thresholdClosingComposition();

    const result = resolveSavedTeam(composition, TEST_POOL);

    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, composition });
  });

  it("pusty skład przechodzi — zero członków to legalny kształt, choć nie da się go zapisać", () => {
    const result = resolveSavedTeam([], TEST_POOL);

    expect(result).toEqual({ ok: true, composition: [] });
  });

  it("odrzuca skład ponad limit sześciu członków — odmowa nie jest zawężona do `unknown-*`", () => {
    // Ten przypadek trzyma umowę „dowolne naruszenie odmawia": zawężenie implementacji do
    // `violations.filter((violation) => violation.kind.startsWith("unknown"))` przeszłoby bez niego
    // na zielono, a siedmiu członków nie zmieści się w sześciu slotach wyspy.
    const composition = TEST_POOL.slice(0, MAX_TEAM_SIZE + 1).map((character) => member(character.id));

    expect(composition).toHaveLength(MAX_TEAM_SIZE + 1);

    const violations = violationsOf(resolveSavedTeam(composition, TEST_POOL));

    expect(violations).toContainEqual({ kind: "too-many-members", count: composition.length });
    expect(violations.every((violation) => !violation.kind.startsWith("unknown"))).toBe(true);
  });

  it("odrzuca skład z `characterId` spoza puli", () => {
    expect(POOL_IDS).not.toContain(ABSENT_ID);

    const result = resolveSavedTeam([member(ABSENT_ID)], TEST_POOL);

    expect(violationsOf(result)).toContainEqual({ kind: "unknown-character", characterId: ABSENT_ID });
  });

  it("odrzuca skład z `perkId` spoza puli — perk cudzej postaci nie należy do tej", () => {
    const [owner, other] = TEST_POOL;
    const foreignPerkId = other.perks[0].id;

    expect(owner.perks.map((perk) => perk.id)).not.toContain(foreignPerkId);

    const result = resolveSavedTeam([member(owner.id, foreignPerkId)], TEST_POOL);

    expect(violationsOf(result)).toContainEqual({
      kind: "unknown-perk",
      characterId: owner.id,
      perkId: foreignPerkId,
    });
  });
});
