import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_PERKS_PER_MEMBER, PERKS_PER_CHARACTER, type PoolCharacter } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface MemberPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: readonly PoolCharacter[];
  /** Identyfikatory postaci już w drużynie — oznaczone w liście i nie do dodania. */
  memberIds: ReadonlySet<string>;
  onAdd: (characterId: string) => void;
}

/**
 * Okno wyboru członka (FR-013): lista postaci po lewej, szczegóły wybranej po prawej.
 *
 * Prymityw `dialog.tsx` ma jasne tokeny shadcn (`bg-background`), więc `DialogContent` dostaje
 * nadpisany `className` w motywie cosmic — tak jak `SubmitButton` nadpisuje `Button`.
 */
export function MemberPickerDialog({ open, onOpenChange, pool, memberIds, onAdd }: MemberPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0f1529] text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">
            Recruit a member
          </DialogTitle>
          <DialogDescription className="text-blue-100/60">Pick a character to add to your team.</DialogDescription>
        </DialogHeader>
        <MemberPickerBody pool={pool} memberIds={memberIds} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

type MemberPickerBodyProps = Pick<MemberPickerDialogProps, "pool" | "memberIds" | "onAdd">;

/**
 * Renderowany wewnątrz `DialogContent`, więc Radix odmontowuje go po zamknięciu i `selectedId`
 * resetuje się sam przy każdym otwarciu — bez `useEffect` (react-hooks `set-state-in-effect`).
 * Domyślny wybór: pierwsza postać spoza drużyny; przy otwartym oknie skład ma ≤ 5 członków
 * z 12 postaci, więc zawsze istnieje.
 */
function MemberPickerBody({ pool, memberIds, onAdd }: MemberPickerBodyProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => pool.find((character) => !memberIds.has(character.id))?.id ?? null,
  );

  const selected = pool.find((character) => character.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1" aria-label="Available characters">
        {pool.map((character) => {
          const inTeam = memberIds.has(character.id);
          const isSelected = character.id === selectedId;

          return (
            <li key={character.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedId(character.id);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                  isSelected
                    ? "border-purple-400/60 bg-purple-500/20"
                    : "border-transparent bg-white/5 hover:border-white/20 hover:bg-white/10",
                  inTeam && "text-white/50",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{character.name}</span>
                  <span className="block text-xs tracking-wide text-purple-300/80 uppercase">
                    {character.specialization}
                  </span>
                </span>
                {inTeam && (
                  <span className="ml-2 shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-[10px] tracking-wide uppercase">
                    In team
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
        {selected ? (
          <>
            <h3 className="text-xl font-semibold">{selected.name}</h3>
            <p className="mt-1 text-xs tracking-wide text-purple-300 uppercase">
              Specialization: {selected.specialization}
            </p>
            <p className="mt-3 text-sm text-blue-100/80">{selected.description}</p>

            <h4 className="mt-4 text-sm font-semibold text-white">
              Perks — up to {MAX_PERKS_PER_MEMBER} of {PERKS_PER_CHARACTER} can be chosen
            </h4>
            <ul className="mt-2 space-y-1">
              {selected.perks.map((perk) => (
                <li
                  key={perk.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{perk.name}</span>
                  <span className="text-xs tracking-wide text-blue-100/60 uppercase">{perk.competency}</span>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="cosmic"
              disabled={memberIds.has(selected.id)}
              onClick={() => {
                onAdd(selected.id);
              }}
              className="mt-6 w-full"
            >
              <UserPlus className="size-4" />
              {memberIds.has(selected.id) ? "Already in team" : "Add to team"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-blue-100/60">Select a character to see details.</p>
        )}
      </div>
    </div>
  );
}
