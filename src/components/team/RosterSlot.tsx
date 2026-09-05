import { UserPlus, X } from "lucide-react";

import type { PoolCharacter } from "@/lib/domain";

interface RosterSlotProps {
  /** Postać zajmująca slot albo `null` dla pustego slotu. */
  member: PoolCharacter | null;
  onRecruit: () => void;
  onRemove: (characterId: string) => void;
}

/** Jeden z sześciu slotów składu — bezstanowy, sterowany propsami jak `FormField`. */
export function RosterSlot({ member, onRecruit, onRemove }: RosterSlotProps) {
  if (member === null) {
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

  return (
    <div className="flex min-h-32 flex-col justify-between rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl">
      <div>
        <p className="font-semibold">{member.name}</p>
        <p className="mt-1 text-xs tracking-wide text-purple-300 uppercase">{member.specialization}</p>
      </div>
      <button
        type="button"
        aria-label={`Remove ${member.name}`}
        onClick={() => {
          onRemove(member.id);
        }}
        className="mt-3 inline-flex items-center gap-1 self-start rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <X className="size-3" />
        Remove
      </button>
    </div>
  );
}
