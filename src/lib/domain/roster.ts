import { MAX_PERKS_PER_MEMBER, MAX_TEAM_SIZE, type CharacterPool, type TeamComposition } from "@/lib/domain/types";

/**
 * Budowanie składu — jedyne miejsce, w którym skład rośnie, maleje i zmienia perki.
 *
 * Interfejs nie składa `MemberSelection` sam: woła `addMember` / `removeMember` / `togglePerk`
 * i pokazuje wynik. Dzięki temu limity „maksimum sześciu członków", „brak powtórzeń" i „maksimum
 * dwa perki na członka" (PRD → FR-012, FR-014, Guardrails) są egzekwowane tu, a nie tylko chowane
 * w interfejsie — a `roster.test.ts` dowodzi, że każdy skład zbudowany tymi funkcjami przechodzi
 * `evaluateTeam` bez jakichkolwiek naruszeń.
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
 * Dokłada postać z pustym `perkIds` — perki zaznacza się potem przez `togglePerk`.
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

/** Powód odrzucenia przełączenia perka. `perk-limit` odpowiada naruszeniu `too-many-perks` z `evaluateTeam`. */
export type PerkRejection =
  | { kind: "member-not-in-team"; characterId: string }
  | { kind: "unknown-perk"; characterId: string; perkId: string }
  | { kind: "perk-limit"; characterId: string; limit: number };

export type TogglePerkResult = { ok: true; composition: TeamComposition } | { ok: false; reason: PerkRejection };

/**
 * Zaznacza perk, jeśli nie jest wybrany, albo odznacza, jeśli jest. Nie mutuje wejścia.
 *
 * Kolejność sprawdzeń jest częścią umowy: członek w składzie → perk należy do tej postaci w puli
 * → (odznaczenie zawsze wchodzi) → limit. Odznaczanie idzie przed limitem, żeby członek z 2/2 mógł
 * zdjąć perk. Członek, którego `characterId` nie ma w puli (możliwe tylko w składzie doklejonym
 * na siłę), daje `unknown-perk` — pula nie zna żadnego jego perka. Nowy perk trafia na koniec
 * `perkIds` (kolejność wyboru, nie kolejność w puli); pozostali członkowie zachowują referencje.
 */
export function togglePerk(
  composition: TeamComposition,
  characterId: string,
  perkId: string,
  pool: CharacterPool,
): TogglePerkResult {
  const member = composition.find((candidate) => candidate.characterId === characterId);

  if (member === undefined) {
    return { ok: false, reason: { kind: "member-not-in-team", characterId } };
  }

  const character = pool.find((candidate) => candidate.id === characterId);

  if (!character?.perks.some((perk) => perk.id === perkId)) {
    return { ok: false, reason: { kind: "unknown-perk", characterId, perkId } };
  }

  if (member.perkIds.includes(perkId)) {
    return {
      ok: true,
      composition: composition.map((candidate) =>
        candidate === member ? { characterId, perkIds: member.perkIds.filter((id) => id !== perkId) } : candidate,
      ),
    };
  }

  if (member.perkIds.length >= MAX_PERKS_PER_MEMBER) {
    return { ok: false, reason: { kind: "perk-limit", characterId, limit: MAX_PERKS_PER_MEMBER } };
  }

  return {
    ok: true,
    composition: composition.map((candidate) =>
      candidate === member ? { characterId, perkIds: [...member.perkIds, perkId] } : candidate,
    ),
  };
}
