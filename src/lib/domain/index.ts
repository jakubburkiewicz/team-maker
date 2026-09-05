export {
  COMPETENCIES,
  COMPETENCY_THRESHOLD,
  MAX_PERKS_PER_MEMBER,
  MAX_TEAM_SIZE,
  PERK_POINTS,
  PERKS_PER_CHARACTER,
  SPECIALIZATION_POINTS,
} from "@/lib/domain/types";

export type {
  Character,
  CharacterPool,
  Competency,
  MemberSelection,
  Perk,
  PoolCharacter,
  PoolPerk,
  TeamComposition,
} from "@/lib/domain/types";

export { CHARACTER_POOL } from "@/lib/domain/character-pool";

export { evaluateTeam } from "@/lib/domain/evaluate-team";

export type { RuleViolation, TeamEvaluation } from "@/lib/domain/evaluate-team";

export { addMember, removeMember, togglePerk } from "@/lib/domain/roster";

export type { AddMemberResult, PerkRejection, RosterRejection, TogglePerkResult } from "@/lib/domain/roster";
