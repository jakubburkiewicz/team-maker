import { Pencil, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";

import DeleteTeamDialog from "@/components/team/DeleteTeamDialog";
import { buttonVariants } from "@/components/ui/button";
import { teamActions, type SavedTeamRef } from "@/lib/team-actions";
import { cn } from "@/lib/utils";

export interface TeamListRow extends SavedTeamRef {
  /**
   * Data zapisu **już sformatowana** przez stronę. Formatowanie zostaje po stronie serwera, bo
   * `Intl.DateTimeFormat.format` rzuca `RangeError` na `Invalid Date`, a strona wpina ten wyjątek
   * w tę samą gałąź awarii co błąd zapytania (`src/pages/index.astro`).
   */
  savedAt: string;
}

interface TeamListProps {
  teams: readonly TeamListRow[];
}

const ICON_ACTION_CLASS = "text-blue-100/80 hover:bg-white/15 hover:text-white";

/**
 * Lista zapisanych drużyn z trzema akcjami w wierszu (pkt 6 zgłoszenia).
 *
 * Wiersz **nie jest** opakowany w jeden link i nie używa wzorca „stretched link": zagnieżdżony
 * element interaktywny to niepoprawny HTML i zepsuta nawigacja klawiaturą, a poza nazwą i trzema
 * ikonami nic w karcie nie ma być klikalne — dzięki temu nazwę-hash da się zaznaczyć myszą.
 * Kolejność Tab idzie za kolejnością wzrokową: nazwa → wyruszenie → edycja → usunięcie.
 *
 * Trzy akcje są bez etykiet, więc nazwę niosą `aria-label` (czytnik ekranu) i `title` (dymek dla
 * myszy) — oba z `@/lib/team-actions`, oba zawierają nazwę-hash, więc wiersze dają się rozróżnić.
 * Wyruszenie i edycja są linkami ostylowanymi przez `buttonVariants`; usunięcie jest przyciskiem,
 * bo prowadzi przez okno potwierdzenia (FR-010), a nie przez nawigację.
 *
 * Cel usuwania jest **jednym stanem** nad całą listą i steruje **jednym** oknem postawionym poza
 * pętlą wierszy: FR-006 nie stawia limitu drużyn na konto, więc okno per wiersz rosłoby razem
 * z listą. Zamknięcie czyści cel, żeby żadne kolejne otwarcie nie odziedziczyło poprzedniego.
 */
export default function TeamList({ teams }: TeamListProps) {
  const [deleteTarget, setDeleteTarget] = useState<SavedTeamRef | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {teams.map((team) => {
          const [embark, edit, remove] = teamActions(team);

          return (
            <li
              key={team.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl"
            >
              <a
                href={edit.href}
                className="rounded font-mono font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <code>{team.name}</code>
              </a>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-blue-100/60">Saved {team.savedAt}</span>
                <div className="flex items-center gap-1">
                  <a
                    href={embark.href}
                    aria-label={embark.ariaLabel}
                    title={embark.ariaLabel}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), ICON_ACTION_CLASS)}
                  >
                    <Rocket className="size-4" />
                  </a>
                  <a
                    href={edit.href}
                    aria-label={edit.ariaLabel}
                    title={edit.ariaLabel}
                    className={cn(buttonVariants({ variant: "ghost", size: "icon" }), ICON_ACTION_CLASS)}
                  >
                    <Pencil className="size-4" />
                  </a>
                  <button
                    type="button"
                    aria-label={remove.ariaLabel}
                    title={remove.ariaLabel}
                    onClick={() => {
                      setDeleteTarget({ id: team.id, name: team.name });
                    }}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "text-red-200 hover:bg-red-500/20 hover:text-red-100",
                    )}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <DeleteTeamDialog
        target={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}
