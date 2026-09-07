import { Trash2 } from "lucide-react";
import { useState } from "react";

import DeleteTeamDialog from "@/components/team/DeleteTeamDialog";
import { Button } from "@/components/ui/button";
import { teamActions, type SavedTeamRef } from "@/lib/team-actions";

interface DeleteTeamButtonProps {
  team: SavedTeamRef;
}

/**
 * Samodzielny wyzwalacz usuwania z własnym stanem okna — dla **gałęzi awarii** `/teams/[id]`:
 * drużyny, której składu nie da się złożyć z dzisiejszą pulą (`inconsistent`), albo takiej, przy
 * której pula chwilowo nie doszła. `TeamComposer` w tych stanach w ogóle się nie renderuje, więc
 * grupa akcji wyspy nie ma jak podać przycisku, a `.astro` nie może trzymać stanu `open` samo.
 *
 * To jedyny konsument tego komponentu — gałąź sukcesu ma wyzwalacz osadzony w `TeamActions`.
 * Oba miejsca są **strukturalnie** wykluczone przez jedno wyrażenie warunkowe w `[id].astro`,
 * a nie przez zgodność dwóch niezależnych warunków, która dałaby cichą awarię w obie strony
 * (dwa przyciski albo zero).
 */
export default function DeleteTeamButton({ team }: DeleteTeamButtonProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [, , remove] = teamActions(team);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        aria-label={remove.ariaLabel}
        onClick={() => {
          setConfirmingDelete(true);
        }}
        className="self-end border border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
      >
        <Trash2 className="size-4" />
        {remove.label}
      </Button>

      <DeleteTeamDialog target={team} open={confirmingDelete} onOpenChange={setConfirmingDelete} />
    </>
  );
}
