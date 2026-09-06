import { UserPlus, X } from "lucide-react";

import {
  MAX_PERKS_PER_MEMBER,
  PERK_POINTS,
  SPECIALIZATION_POINTS,
  type MemberSelection,
  type PoolCharacter,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Zajęty slot: postać z puli razem z oryginalnym wyborem gracza (które perki). */
export interface RosterMember {
  character: PoolCharacter;
  selection: MemberSelection;
}

/** Komplet akcji slotu — albo wszystkie, albo żadna (patrz `handlers` w `RosterSlotProps`). */
export interface RosterSlotHandlers {
  onRecruit: () => void;
  onRemove: (characterId: string) => void;
  onTogglePerk: (characterId: string, perkId: string) => void;
}

interface RosterSlotProps {
  /** Członek zajmujący slot albo `null` dla pustego slotu. */
  member: RosterMember | null;
  /**
   * Akcje slotu. **Pominięcie propu to tryb tylko do odczytu** — w slocie nie istnieje wtedy
   * żaden element akcji (nie `<button disabled>`, tylko brak przycisku). Akcje są jedną grupą,
   * a nie trzema osobnymi propami, żeby nie dało się zbudować stanu „połowa slotu klikalna",
   * i żeby tryb odczytu nie musiał przekazywać pustych funkcji-atrap.
   */
  handlers?: RosterSlotHandlers;
}

/**
 * Jeden z sześciu slotów składu — bezstanowy, sterowany propsami jak `FormField`.
 *
 * Karta zajętego slotu jest jedyną powierzchnią wyboru perków (FR-014): trzy przełączniki
 * z licznikiem `N/2`, przy 2/2 niewybrany perk jest wyłączony. Limit nazwany wprost i wyłączany
 * prewencyjnie, ale o legalności rozstrzyga `togglePerk` w wyspie — odrzucony wynik zostawia
 * stan bez zmian.
 *
 * W trybie odczytu (`handlers` pominięte) perki są `<span>`, nie `<button>`, a niewybrany perk
 * **pozostaje w pełni widoczny**: przy zapisanych dwóch perkach wyszarzenie trzeciego mówiłoby
 * „niedostępny", podczas gdy FR-014 wymaga odczytu „niewybrany" — trzeci perk jest częścią
 * zapisanego wyboru „2 z 3", a nie brakiem możliwości.
 */
export function RosterSlot({ member, handlers }: RosterSlotProps) {
  // Zdjęte do lokalnych `const`, bo TypeScript nie utrzymuje zawężenia parametru wewnątrz
  // funkcji zwrotnych — bez tego `onClick` musiałby sięgać po `handlers` z operatorem `!`.
  const onRecruit = handlers?.onRecruit;
  const onRemove = handlers?.onRemove;
  const onTogglePerk = handlers?.onTogglePerk;

  if (member === null) {
    // Pusty slot w trybie odczytu zostaje na miejscu (sześć slotów czyta się tak samo jak przy
    // kompletowaniu), ale bez `onClick`, bez hovera i bez etykiety „Recruit".
    if (onRecruit === undefined) {
      return (
        <div className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-4 text-blue-100/40">
          <span className="text-sm">Empty slot</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={onRecruit}
        className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-4 text-blue-100/60 transition-colors hover:border-purple-400/60 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <UserPlus className="size-6" />
        <span className="text-sm font-medium">Recruit</span>
      </button>
    );
  }

  const { character, selection } = member;
  const selectedCount = selection.perkIds.length;
  const limitReached = selectedCount >= MAX_PERKS_PER_MEMBER;

  return (
    <div className="flex min-h-32 flex-col rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl">
      <div>
        <p className="font-semibold">{character.name}</p>
        <p className="mt-1 text-xs tracking-wide text-purple-300 uppercase">
          {character.specialization}
          <span className="ml-2 text-blue-100/60">+{SPECIALIZATION_POINTS} points</span>
        </p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold text-blue-100/80">
          Perks {selectedCount}/{MAX_PERKS_PER_MEMBER}
        </p>
        <ul className="mt-1 space-y-1">
          {character.perks.map((perk) => {
            const selected = selection.perkIds.includes(perk.id);
            const label = (
              <>
                <span className="truncate font-medium">{perk.name}</span>
                <span className="shrink-0 tracking-wide text-blue-100/60 uppercase">
                  {perk.competency} +{PERK_POINTS}
                </span>
              </>
            );
            const base = cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs",
              selected ? "border-purple-400/60 bg-purple-500/20" : "border-white/10 bg-white/5",
            );

            return (
              <li key={perk.id}>
                {onTogglePerk === undefined ? (
                  <span className={base}>{label}</span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={!selected && limitReached}
                    onClick={() => {
                      onTogglePerk(character.id, perk.id);
                    }}
                    className={cn(
                      base,
                      "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40",
                      !selected && "hover:border-white/20 hover:bg-white/10",
                    )}
                  >
                    {label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {onRemove === undefined ? null : (
        <button
          type="button"
          aria-label={`Remove ${character.name}`}
          onClick={() => {
            onRemove(character.id);
          }}
          className="mt-3 inline-flex items-center gap-1 self-start rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <X className="size-3" />
          Remove
        </button>
      )}
    </div>
  );
}
