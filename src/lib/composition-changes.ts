import type { TeamComposition } from "@/lib/domain";

/**
 * Czy widoczny skład różni się od tego, który jest w bazie.
 *
 * Jedyny warunek, od którego zależy blokada przycisku „Embark on the job" w kolumnie bocznej
 * `/teams/[id]`: wyruszenie nie zapisuje, więc przy niezapisanych zmianach musi odmówić, zamiast
 * cicho wyprowadzić gracza z ekranu i zgubić jego pracę.
 *
 * Porównanie jest **zbiorowe, nie pozycyjne**, na obu poziomach: ten sam komplet postaci w innej
 * kolejności slotów i ten sam komplet perków wybrany w innej kolejności to **brak** zmian.
 * Gracz, który zdejmie perk i wybierze go z powrotem, ma z powrotem zapisany skład —
 * `JSON.stringify` blokowałby przycisk po ruchu, który niczego nie zmienił.
 *
 * Umiejscowienie: `src/lib/`, nie `src/lib/domain/` — funkcja nie dokłada reguły domenowej, tylko
 * porównuje dwa jej wejścia, tak jak `src/lib/team-view.ts` tylko czyta jej werdykt. Moduł jest
 * czysty: wyłącznie typy z `@/lib/domain`, bez `astro:*` i bez `@/lib/supabase`
 * (AGENTS.md → Hard rules).
 */
export function hasUnsavedChanges(current: TeamComposition, saved: TeamComposition): boolean {
  const currentByCharacter = indexByCharacter(current);
  const savedByCharacter = indexByCharacter(saved);

  // Powtórzona postać zwinęłaby się w mapie w jeden klucz i przeszła jako „brak zmian" —
  // np. `[A, A]` wobec `[A, B]`. Domena powtórzeń nie dopuszcza (FR-012), więc to obrona w głąb:
  // stan nieosiągalny z wyspy ma dać „są zmiany", a nie cichą równość.
  if (currentByCharacter.size !== current.length || savedByCharacter.size !== saved.length) {
    return true;
  }

  if (currentByCharacter.size !== savedByCharacter.size) {
    return true;
  }

  for (const [characterId, currentPerkIds] of currentByCharacter) {
    const savedPerkIds = savedByCharacter.get(characterId);

    if (savedPerkIds === undefined || !samePerks(currentPerkIds, savedPerkIds)) {
      return true;
    }
  }

  return false;
}

function indexByCharacter(composition: TeamComposition): Map<string, readonly string[]> {
  return new Map(composition.map((member) => [member.characterId, member.perkIds]));
}

/** Równość kompletów perków bez względu na kolejność wyboru — z tą samą obroną przed powtórzeniem. */
function samePerks(current: readonly string[], saved: readonly string[]): boolean {
  if (current.length !== saved.length) {
    return false;
  }

  const currentPerks = new Set(current);
  const savedPerks = new Set(saved);

  if (currentPerks.size !== current.length || savedPerks.size !== saved.length) {
    return false;
  }

  for (const perkId of currentPerks) {
    if (!savedPerks.has(perkId)) {
      return false;
    }
  }

  return true;
}
