import { evaluateTeam, type CharacterPool, type RuleViolation, type TeamComposition } from "@/lib/domain";

/**
 * Decyzja odczytu drużyny — jedno miejsce, w którym zapada „ten zapisany skład da się pokazać
 * z aktualną pulą".
 *
 * Powód istnienia: `composition` jest `jsonb` bez klucza obcego do `characters`, więc zapisany
 * skład może rozjechać się z pulą (zmiana seeda, usunięty perk). `TeamComposer` mapuje nieznaną
 * postać na pusty slot, więc ekran pokazałby skład **inny niż zapisany** — a edycja (S-05),
 * zapisując to, co ekran pokazuje, skasowałaby członka bezpowrotnie. Dlatego skład jest
 * sprawdzany, zanim trafi do wyspy: dowolne naruszenie zamienia widok w stan „drużyna niedostępna".
 *
 * Moduł jest czysty: bez `astro:*`, bez `@/lib/supabase`. Leży w `src/lib/` (granica odczytu),
 * nie w `src/lib/domain/` — nie dokłada reguły, tylko czyta werdykt, który `evaluateTeam` i tak
 * wydaje. Kształt wyniku jest symetryczny do `gateTeamSubmission` w `team-submission.ts`.
 */

export type SavedTeamResolution =
  | { ok: true; composition: TeamComposition }
  | { ok: false; violations: readonly RuleViolation[] };

/**
 * Odrzuca przy **dowolnym** naruszeniu z `evaluateTeam`, nie tylko przy `unknown-character`
 * i `unknown-perk`: skład z siedmioma członkami też nie zmieści się w sześciu slotach, a skład
 * z powtórzoną postacią rozjechałby licznik `Members: N/6`.
 *
 * **Próg nie jest tu sprawdzany ponownie** (`isValid` celowo pominięte) — o progu rozstrzyga
 * bramka zapisu; blokowanie odczytu drużyny poniżej progu ukrywałoby dane gracza zamiast je
 * pokazać.
 */
export function resolveSavedTeam(composition: TeamComposition, pool: CharacterPool): SavedTeamResolution {
  const { violations } = evaluateTeam(composition, pool);

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return { ok: true, composition };
}
