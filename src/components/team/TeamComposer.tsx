import { useState } from "react";

import { RosterSlot } from "@/components/team/RosterSlot";
import { MAX_TEAM_SIZE, removeMember, type PoolCharacter, type TeamComposition } from "@/lib/domain";

interface Props {
  pool: readonly PoolCharacter[];
}

/**
 * Wyspa kompletowania drużyny — jedyny właściciel stanu `composition` w całym fragmencie.
 *
 * Skład żyje wyłącznie w pamięci wyspy i nie przeżywa odświeżenia strony (rozstrzygnięcie
 * niewiadomej S-01). Skład rośnie i maleje tylko przez `addMember` / `removeMember` z domeny —
 * wyspa nie składa `MemberSelection` sama.
 */
export default function TeamComposer({ pool }: Props) {
  const [composition, setComposition] = useState<TeamComposition>([]);

  const charactersById = new Map(pool.map((character) => [character.id, character]));

  function handleRecruit() {
    // Okno wyboru członka przychodzi w Fazie 3.
  }

  function handleRemove(characterId: string) {
    setComposition((current) => removeMember(current, characterId));
  }

  const slots = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
    const selection = composition.at(index);
    return selection === undefined ? null : (charactersById.get(selection.characterId) ?? null);
  });

  return (
    <section className="w-full text-white">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Roster</h2>
        <p className="text-sm text-blue-100/70">
          Members: <span className="font-semibold text-white">{composition.length}</span>/{MAX_TEAM_SIZE}
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-4">
        {slots.map((member, index) => (
          <li key={member?.id ?? `empty-${index}`}>
            <RosterSlot member={member} onRecruit={handleRecruit} onRemove={handleRemove} />
          </li>
        ))}
      </ul>
    </section>
  );
}
