export {
  COMPETENCIES,
  COMPETENCY_THRESHOLD,
  MAX_PERKS_PER_MEMBER,
  MAX_TEAM_SIZE,
  PERK_POINTS,
  PERKS_PER_CHARACTER,
  SPECIALIZATION_POINTS,
} from "@/lib/domain/types";

export type { Character, CharacterPool, Competency, MemberSelection, Perk, TeamComposition } from "@/lib/domain/types";

export { evaluateTeam } from "@/lib/domain/evaluate-team";

export type { RuleViolation, TeamEvaluation } from "@/lib/domain/evaluate-team";
