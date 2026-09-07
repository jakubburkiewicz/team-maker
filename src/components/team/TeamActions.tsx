import { Rocket, Trash2 } from "lucide-react";
import { useState } from "react";

import DeleteTeamDialog from "@/components/team/DeleteTeamDialog";
import { Button } from "@/components/ui/button";
import { teamActions, type SavedTeamRef } from "@/lib/team-actions";

interface TeamActionsProps {
  /** Zapisana drużyna, której akcje dotyczą. Grupa istnieje **wyłącznie** dla istniejącego wiersza. */
  team: SavedTeamRef;
  /**
   * Czy widoczny skład różni się od zapisanego (`hasUnsavedChanges` z `@/lib/composition-changes`).
   * Warunek zna wyłącznie wyspa kompozytora, więc przychodzi propem — dwie wyspy nie dzielą stanu.
   */
  hasUnsavedChanges: boolean;
}

const EMBARK_HINT_ID = "team-actions-embark-hint";

/**
 * Akcje dotyczące **istniejącej** drużyny w kolumnie bocznej `/teams/[id]`: wyruszenie i usunięcie
 * (pkt 7 zgłoszenia). Grupa powstaje osobno od `CompositionGate`, bo bramka istnieje dla progu
 * i `disabled`, a nie dla etykiet — wciągnięcie do niej dwóch akcji niezwiązanych z progiem
 * rozmyłoby jej powód istnienia.
 *
 * Oba przyciski mają ikonę **i** etykietę; ikony bez tekstu są zarezerwowane dla wiersza listy
 * na `/`, gdzie o akcji mówi kontekst wiersza.
 *
 * Wyruszenie **nie zapisuje**: przy niezapisanych zmianach odmawia, żeby nie wyprowadzić gracza
 * z ekranu **tą jedną drogą**. To nie jest ochrona pracy w toku i nie udaje jej: nagłówek powłoki
 * (`AppHeader` → `NAV_ITEMS`), Wstecz i zamknięcie karty gubią zmiany tak samo, bez ostrzeżenia,
 * bo `AppLayout` nie zakłada `beforeunload`. Szersza obietnica wymagałaby zakresu, którego
 * Non-Goals PRD nie przewidują. Nieaktywny stan wyraża `<button disabled>`, nie `<a>`
 * z `aria-disabled` — tylko przycisk jest rzeczywiście nieklikalny i nienawigowalny klawiaturą.
 * Powód niesie **statyczny tekst** pod przyciskiem, nie dymek: `Button` ma
 * `disabled:pointer-events-none`, więc `title` na wyłączonym przycisku nigdy by się nie pokazał
 * (ta sama pułapka, którą odnotowuje docstring `CompositionGate`).
 *
 * Adresy i teksty biorą się z `@/lib/team-actions`, nie z literałów — inaczej rozjazd z wierszem
 * listy wyszedłby dopiero na ekranie.
 */
export function TeamActions({ team, hasUnsavedChanges }: TeamActionsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [embark, , remove] = teamActions(team);

  return (
    <div className="flex flex-col items-stretch gap-2">
      {hasUnsavedChanges ? (
        <>
          <Button
            type="button"
            variant="ghost"
            disabled
            aria-label={embark.ariaLabel}
            aria-describedby={EMBARK_HINT_ID}
            className="w-full border border-purple-400/40 bg-purple-500/15 text-purple-100"
          >
            <Rocket className="size-4" />
            {embark.label}
          </Button>
          <p id={EMBARK_HINT_ID} className="text-center text-sm text-blue-100/60">
            Save your changes first — embarking does not save them.
          </p>
        </>
      ) : (
        <Button
          asChild
          variant="ghost"
          className="w-full border border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/25"
        >
          <a href={embark.href} aria-label={embark.ariaLabel}>
            <Rocket className="size-4" />
            {embark.label}
          </a>
        </Button>
      )}

      <Button
        type="button"
        variant="destructive"
        aria-label={remove.ariaLabel}
        onClick={() => {
          setConfirmingDelete(true);
        }}
        className="w-full border border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25"
      >
        <Trash2 className="size-4" />
        {remove.label}
      </Button>

      <DeleteTeamDialog target={team} open={confirmingDelete} onOpenChange={setConfirmingDelete} />
    </div>
  );
}
