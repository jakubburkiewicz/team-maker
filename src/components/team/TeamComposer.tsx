import { useState } from "react";

import { CompetencyRadar } from "@/components/team/CompetencyRadar";
import { EmbarkGate } from "@/components/team/EmbarkGate";
import { MemberPickerDialog } from "@/components/team/MemberPickerDialog";
import { RosterSlot, type RosterMember } from "@/components/team/RosterSlot";
import {
  COMPETENCY_THRESHOLD,
  MAX_TEAM_SIZE,
  addMember,
  evaluateTeam,
  removeMember,
  togglePerk,
  type PoolCharacter,
  type TeamComposition,
} from "@/lib/domain";

interface Props {
  pool: readonly PoolCharacter[];
}

/**
 * Wyspa kompletowania drużyny — jedyny właściciel stanu `composition` w całym fragmencie.
 *
 * Skład żyje wyłącznie w pamięci wyspy i nie przeżywa odświeżenia strony (rozstrzygnięcie
 * niewiadomej S-01). Skład zmienia się tylko przez `addMember` / `removeMember` / `togglePerk`
 * z domeny — wyspa nie składa `MemberSelection` sama. Interfejs wyłącza ruchy prewencyjnie
 * (postać już w drużynie, brak „Recruit" przy 6/6, trzeci perk przy 2/2), ale o legalności
 * rozstrzyga domena: odrzucony wynik zostawia stan bez zmian.
 *
 * Wykres i bramka żyją w tej samej wyspie, bo dwie wyspy nie dzielą stanu. `evaluateTeam` jest
 * liczone przy każdym renderze, bez memoizacji — react-compiler robi to sam, a koszt to siedem
 * liczników nad ≤ 6 członkami (NFR 200 ms z zapasem).
 */
export default function TeamComposer({ pool }: Props) {
  const [composition, setComposition] = useState<TeamComposition>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const charactersById = new Map(pool.map((character) => [character.id, character]));
  const memberIds = new Set(composition.map((member) => member.characterId));
  const evaluation = evaluateTeam(composition, pool);

  function handleRecruit() {
    setPickerOpen(true);
  }

  function handleAdd(characterId: string) {
    const result = addMember(composition, characterId, pool);
    if (!result.ok) {
      return;
    }
    setComposition(result.composition);
    setPickerOpen(false);
  }

  function handleRemove(characterId: string) {
    setComposition((current) => removeMember(current, characterId));
  }

  function handleTogglePerk(characterId: string, perkId: string) {
    // Przy odrzuceniu wraca `current` (ta sama referencja) — bez re-renderu, jak `removeMember`.
    setComposition((current) => {
      const result = togglePerk(current, characterId, perkId, pool);
      return result.ok ? result.composition : current;
    });
  }

  // Nieznany `characterId` → pusty slot, jak w S-01; co z nim robić rozstrzyga S-04.
  const slots = Array.from({ length: MAX_TEAM_SIZE }, (_, index): RosterMember | null => {
    const selection = composition.at(index);
    if (selection === undefined) return null;
    const character = charactersById.get(selection.characterId);
    return character === undefined ? null : { character, selection };
  });

  return (
    <section className="grid w-full gap-6 text-white lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Roster</h2>
          <p className="text-sm text-blue-100/70">
            Members: <span className="font-semibold text-white">{composition.length}</span>/{MAX_TEAM_SIZE}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-4">
          {slots.map((member, index) => (
            <li key={member?.character.id ?? `empty-${index}`}>
              <RosterSlot
                member={member}
                onRecruit={handleRecruit}
                onRemove={handleRemove}
                onTogglePerk={handleTogglePerk}
              />
            </li>
          ))}
        </ul>
      </div>
      <aside className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Competencies</h2>
        {/*
          Umowa z `evaluate-team.ts`: `scores` liczą surowy wybór, także odrzucony przez limity, więc
          wykres czyta je tylko przy pustym `violations`. Skład budowany wyłącznie przez `roster.ts`
          nigdy ich nie ma (dowód: `roster.test.ts`) — ta gałąź jest obroną w głąb.
        */}
        {evaluation.violations.length === 0 ? (
          <CompetencyRadar scores={evaluation.scores} threshold={COMPETENCY_THRESHOLD} />
        ) : (
          <p className="text-sm text-red-200">The roster breaks a team limit, so the chart cannot be shown.</p>
        )}
        <EmbarkGate ready={evaluation.isValid} composition={composition} />
      </aside>
      <MemberPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        pool={pool}
        memberIds={memberIds}
        onAdd={handleAdd}
      />
    </section>
  );
}
