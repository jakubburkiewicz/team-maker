import { MAX_TEAM_SIZE, type CharacterPool, type TeamComposition } from "@/lib/domain/types";

/**
 * Budowanie składu — jedyne miejsce, w którym skład rośnie i maleje.
 *
 * Interfejs nie składa `MemberSelection` sam: woła `addMember` / `removeMember` i pokazuje wynik.
 * Dzięki temu limity „maksimum sześciu członków" i „brak powtórzeń" (PRD → FR-012, Guardrails)
 * są egzekwowane tu, a nie tylko chowane w interfejsie — a `roster.test.ts` dowodzi, że każdy
 * skład zbudowany tymi funkcjami przechodzi `evaluateTeam` bez naruszeń limitów składu.
 *
 * Moduł jest czysty jak reszta `src/lib/domain/`: bez `astro:*`, bez Supabase, bez `src/pages/`.
 */

/** Powód odrzucenia ruchu. Każdy wariant odpowiada jednemu naruszeniu z `evaluateTeam`. */
export type RosterRejection =
  | { kind: "team-full"; limit: number }
  | { kind: "already-in-team"; characterId: string }
  | { kind: "unknown-character"; characterId: string };

export type AddMemberResult = { ok: true; composition: TeamComposition } | { ok: false; reason: RosterRejection };

/**
 * Dokłada postać z pustym `perkIds` (wybór perków przychodzi w S-02).
 *
 * Nie mutuje wejścia i nigdy nie zwraca składu łamiącego limity. Kolejność sprawdzeń jest częścią
 * umowy: pełny skład → duplikat → nieznana postać — przy pełnym składzie i duplikacie wraca
 * `team-full`. Pula jest argumentem (nie importem `CHARACTER_POOL`), tak jak w `evaluateTeam`:
 * wyspa dostaje pulę z bazy, a test podaje własną.
 */
export function addMember(composition: TeamComposition, characterId: string, pool: CharacterPool): AddMemberResult {
  if (composition.length >= MAX_TEAM_SIZE) {
    return { ok: false, reason: { kind: "team-full", limit: MAX_TEAM_SIZE } };
  }

  if (composition.some((member) => member.characterId === characterId)) {
    return { ok: false, reason: { kind: "already-in-team", characterId } };
  }

  if (!pool.some((character) => character.id === characterId)) {
    return { ok: false, reason: { kind: "unknown-character", characterId } };
  }

  return { ok: true, composition: [...composition, { characterId, perkIds: [] }] };
}

/**
 * Zwraca skład bez wskazanej postaci, zachowując kolejność pozostałych. Gdy postaci nie ma
 * w składzie — zwraca ten sam skład (ta sama referencja), więc `useState` nie widzi zmiany.
 */
export function removeMember(composition: TeamComposition, characterId: string): TeamComposition {
  if (!composition.some((member) => member.characterId === characterId)) {
    return composition;
  }

  return composition.filter((member) => member.characterId !== characterId);
}
