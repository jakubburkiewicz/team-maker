import {
  COMPETENCIES,
  COMPETENCY_THRESHOLD,
  MAX_PERKS_PER_MEMBER,
  MAX_TEAM_SIZE,
  PERK_POINTS,
  SPECIALIZATION_POINTS,
  type Character,
  type CharacterPool,
  type Competency,
  type TeamComposition,
} from "@/lib/domain/types";

/** Naruszony limit składu. Każdy wariant odpowiada jednemu zapisowi z PRD → Guardrails. */
export type RuleViolation =
  | { kind: "too-many-members"; count: number }
  | { kind: "duplicate-character"; characterId: string }
  | { kind: "too-many-perks"; characterId: string; count: number }
  | { kind: "unknown-character"; characterId: string }
  | { kind: "unknown-perk"; characterId: string; perkId: string };

export interface TeamEvaluation {
  /** Siedem sum punktowych — po jednej na kompetencję. */
  scores: Record<Competency, number>;
  /** Punkty brakujące do progu w każdej kompetencji; 0 gdy domknięta. */
  missing: Record<Competency, number>;
  /** Naruszone limity składu, w kolejności: najpierw drużynowe, potem członkowie po kolei. */
  violations: readonly RuleViolation[];
  /** Binarny werdykt: brak naruszeń ORAZ każda kompetencja na progu. */
  isValid: boolean;
}

function zeroedByCompetency(): Record<Competency, number> {
  return Object.fromEntries(COMPETENCIES.map((competency) => [competency, 0])) as Record<Competency, number>;
}

/**
 * Rozstrzyga, czy skład pokrywa wszystkie siedem kompetencji na poziomie progu.
 *
 * Funkcja jest czysta: nie mutuje ani składu, ani puli, nie sięga po zegar i nie loguje.
 * Zwraca komplet wyjść z PRD → `## Business Logic` — sumy, braki i werdykt — plus listę
 * naruszonych limitów składu, żeby wykres (S-02), licznik braków (S-08) i bramka zapisu
 * (S-03/S-05) czytały jedno źródło i nie mogły się rozjechać.
 */
export function evaluateTeam(composition: TeamComposition, pool: CharacterPool): TeamEvaluation {
  const charactersById = new Map<string, Character>(pool.map((character) => [character.id, character]));

  const scores = zeroedByCompetency();
  const violations: RuleViolation[] = [];

  if (composition.length > MAX_TEAM_SIZE) {
    violations.push({ kind: "too-many-members", count: composition.length });
  }

  const seenCharacterIds = new Set<string>();

  for (const selection of composition) {
    const { characterId, perkIds } = selection;

    if (seenCharacterIds.has(characterId)) {
      violations.push({ kind: "duplicate-character", characterId });
    }
    seenCharacterIds.add(characterId);

    if (perkIds.length > MAX_PERKS_PER_MEMBER) {
      violations.push({ kind: "too-many-perks", characterId, count: perkIds.length });
    }

    const character = charactersById.get(characterId);

    if (character === undefined) {
      violations.push({ kind: "unknown-character", characterId });
      continue;
    }

    scores[character.specialization] += SPECIALIZATION_POINTS;

    for (const perkId of perkIds) {
      const perk = character.perks.find((candidate) => candidate.id === perkId);

      if (perk === undefined) {
        violations.push({ kind: "unknown-perk", characterId, perkId });
        continue;
      }

      scores[perk.competency] += PERK_POINTS;
    }
  }

  const missing = zeroedByCompetency();
  let meetsThreshold = true;

  for (const competency of COMPETENCIES) {
    const gap = COMPETENCY_THRESHOLD - scores[competency];

    if (gap > 0) {
      missing[competency] = gap;
      meetsThreshold = false;
    }
  }

  return {
    scores,
    missing,
    violations,
    isValid: violations.length === 0 && meetsThreshold,
  };
}
