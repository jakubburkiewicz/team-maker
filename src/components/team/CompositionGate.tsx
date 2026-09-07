import { Rocket, Save } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { type TeamComposition } from "@/lib/domain";
import { BELOW_THRESHOLD_MESSAGE, COMPOSITION_FIELD } from "@/lib/team-submission";
import { cn } from "@/lib/utils";

interface CompositionGateProps {
  /** `evaluation.isValid` — brak naruszeń i każda kompetencja na progu. */
  ready: boolean;
  /** Bieżący skład wyspy — trafia do ukrytego pola formularza przy każdym renderze. */
  composition: TeamComposition;
  /**
   * Cel zapisu, i **jedyny** nośnik trybu: brak znaczy „tworzenie" (`POST /api/teams`), obecność
   * znaczy „edycja tej drużyny" (`POST /api/teams/<id>`). Osobnej flagi trybu nie ma celowo —
   * dzięki temu „edycja bez id" i „tworzenie z id" są niereprezentowalne.
   */
  teamId?: string;
}

const HINT_ID = "composition-gate-hint";

/**
 * Bramka zapisu składu — jedna dla obu kierunków (FR-007 i FR-009): natywny formularz z ukrytym
 * polem JSON, konwencja repo (`SignInForm`, `?error=`). Komponent nie rozdwaja się na tworzenie
 * i edycję, bo powodem jego istnienia jest **próg i `disabled`**, nie etykieta: dwie bramki
 * oznaczałyby dwie kopie warunku `!ready`, a tekst FR-018 przychodzi i tak importem, ten sam,
 * którym odrzucają obie trasy zapisu.
 *
 * `disabled` jest jedyną i wystarczającą barierą progu: zablokowany przycisk nie wysyła formularza,
 * a implicit submission (Enter) wymaga pola tekstowego, którego tu nie ma — `onSubmit` nie jest
 * więc bramką `!ready`, tylko zapisem „już wysłano", żeby dwuklik na wolnym łączu nie zapisał
 * dwa razy. Nie woła `preventDefault`: przeglądarka nawiguje, więc wyspa nie musi nic resetować.
 *
 * Nie `useFormStatus` — React ustawia `pending` wyłącznie dla `action` będącego funkcją
 * (`startHostTransition`); przy `action` będącym stringiem zostaje `false` na stałe (przegląd S-03,
 * F2). Komunikat jest statycznym tekstem pod przyciskiem, nie tooltipem — `Button` ma
 * `disabled:pointer-events-none`.
 */
export function CompositionGate({ ready, composition, teamId }: CompositionGateProps) {
  const [submitting, setSubmitting] = useState(false);

  const editing = teamId !== undefined;
  const Icon = editing ? Save : Rocket;

  return (
    <form
      method="POST"
      action={editing ? `/api/teams/${encodeURIComponent(teamId)}` : "/api/teams"}
      onSubmit={() => {
        setSubmitting(true);
      }}
      className="flex flex-col items-stretch gap-2"
    >
      <input type="hidden" name={COMPOSITION_FIELD} value={JSON.stringify(composition)} />
      <Button
        type="submit"
        variant="cosmic"
        disabled={!ready || submitting}
        aria-describedby={HINT_ID}
        className="w-full"
      >
        <Icon className="size-4" />
        {editing ? (submitting ? "Saving…" : "Save changes") : submitting ? "Embarking…" : "Embark on the job"}
      </Button>
      <p id={HINT_ID} className={cn("text-center text-sm", ready ? "text-emerald-300" : "text-blue-100/60")}>
        {ready ? "All seven competencies are covered." : BELOW_THRESHOLD_MESSAGE}
      </p>
    </form>
  );
}
