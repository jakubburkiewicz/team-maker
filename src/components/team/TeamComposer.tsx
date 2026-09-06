import { useState } from "react";

import { CompetencyRadar } from "@/components/team/CompetencyRadar";
import { EmbarkGate } from "@/components/team/EmbarkGate";
import { MemberPickerDialog } from "@/components/team/MemberPickerDialog";
import { RosterSlot, type RosterMember, type RosterSlotHandlers } from "@/components/team/RosterSlot";
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
  /**
   * Skład, od którego wyspa startuje — **wartość początkowa `useState`**, nie synchronizowana
   * przez `useEffect`. Wyspa zostaje jedynym właścicielem stanu, więc S-05, dodając zapis, nie
   * odziedziczy dwóch źródeł prawdy.
   */
  initialComposition?: TeamComposition;
  /**
   * Tryb tylko do odczytu (FR-008: jeden widok obsługujący kompletowanie i podgląd zapisanej
   * drużyny). Sloty nie dostają akcji, `MemberPickerDialog` nie jest montowany, a `EmbarkGate`
   * nie jest renderowany — formularz `POST /api/teams` nie może istnieć na ekranie istniejącej
   * drużyny. W jego miejsce nie wchodzi nic: nazwę-hash niesie nagłówek strony.
   */
  readOnly?: boolean;
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
 *
 * Domyślne wartości `initialComposition` i `readOnly` zachowują zachowanie `/teams/new` sprzed
 * S-04: pusty skład i pełna interaktywność.
 */
export default function TeamComposer({ pool, initialComposition = [], readOnly = false }: Props) {
  const [composition, setComposition] = useState<TeamComposition>(initialComposition);
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

  // Nieznany `characterId` → pusty slot. Na `/teams/new` stan nieosiągalny (skład powstaje przez
  // `roster.ts` z tej samej puli), a skład z bazy odcina `resolveSavedTeam` (`src/lib/team-view.ts`)
  // zanim tu dotrze — strona szczegółów pokazuje wtedy stan awarii zamiast częściowego składu.
  const slots = Array.from({ length: MAX_TEAM_SIZE }, (_, index): RosterMember | null => {
    const selection = composition.at(index);
    if (selection === undefined) return null;
    const character = charactersById.get(selection.characterId);
    return character === undefined ? null : { character, selection };
  });

  // Jedna grupa albo nic: `undefined` znaczy „ten slot nie ma żadnego elementu akcji". Bez tego
  // tryb odczytu musiałby wstrzykiwać puste funkcje-atrapy pod klikalne przyciski.
  const handlers: RosterSlotHandlers | undefined = readOnly
    ? undefined
    : { onRecruit: handleRecruit, onRemove: handleRemove, onTogglePerk: handleTogglePerk };

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
              <RosterSlot member={member} handlers={handlers} />
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
        {readOnly ? null : <EmbarkGate ready={evaluation.isValid} composition={composition} />}
      </aside>
      {readOnly ? null : (
        <MemberPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          pool={pool}
          memberIds={memberIds}
          onAdd={handleAdd}
        />
      )}
    </section>
  );
}
