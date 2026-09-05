import { Rocket } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { COMPETENCY_THRESHOLD, type TeamComposition } from "@/lib/domain";
import { COMPOSITION_FIELD } from "@/lib/team-submission";
import { cn } from "@/lib/utils";

interface EmbarkGateProps {
  /** `evaluation.isValid` — brak naruszeń i każda kompetencja na progu. */
  ready: boolean;
  /** Bieżący skład wyspy — trafia do ukrytego pola formularza przy każdym renderze. */
  composition: TeamComposition;
}

const HINT_ID = "embark-hint";

/**
 * Bramka „Embark on the job" (FR-018 + FR-007): natywny formularz `POST /api/teams` z ukrytym
 * polem JSON — konwencja repo (`SignInForm`, `?error=`). `disabled` jest jedyną i wystarczającą
 * barierą progu: zablokowany przycisk nie wysyła formularza, a implicit submission (Enter) wymaga
 * pola tekstowego, którego tu nie ma — `onSubmit` nie jest więc bramką `!ready`, tylko zapisem
 * „już wysłano", żeby dwuklik na wolnym łączu nie zapisał dwóch drużyn. Nie woła
 * `preventDefault`: przeglądarka nawiguje, więc wyspa nie musi nic resetować.
 *
 * Nie `useFormStatus` — React ustawia `pending` wyłącznie dla `action` będącego funkcją
 * (`startHostTransition`); przy `action="/api/teams"` zostaje `false` na stałe (przegląd S-03, F2).
 * Komunikat jest statycznym tekstem pod przyciskiem, nie tooltipem — `Button` ma
 * `disabled:pointer-events-none`.
 */
export function EmbarkGate({ ready, composition }: EmbarkGateProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      method="POST"
      action="/api/teams"
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
        <Rocket className="size-4" />
        {submitting ? "Embarking…" : "Embark on the job"}
      </Button>
      <p id={HINT_ID} className={cn("text-center text-sm", ready ? "text-emerald-300" : "text-blue-100/60")}>
        {ready
          ? "All seven competencies are covered."
          : `Every competency needs at least ${COMPETENCY_THRESHOLD} points before the team can embark.`}
      </p>
    </form>
  );
}
