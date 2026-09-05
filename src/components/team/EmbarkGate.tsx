import { Rocket } from "lucide-react";
import { useFormStatus } from "react-dom";

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
 * Przycisk wysyłki — osobny komponent, bo `useFormStatus()` czyta status najbliższego
 * formularza-przodka, więc musi być **dzieckiem** `<form>` (wzorzec `SubmitButton`).
 */
function EmbarkButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="cosmic" disabled={!ready || pending} aria-describedby={HINT_ID} className="w-full">
      <Rocket className="size-4" />
      {pending ? "Embarking…" : "Embark on the job"}
    </Button>
  );
}

/**
 * Bramka „Embark on the job" (FR-018 + FR-007): natywny formularz `POST /api/teams` z ukrytym
 * polem JSON — konwencja repo (`SignInForm`, `?error=`), `useFormStatus` za darmo. `disabled` jest
 * jedyną i wystarczającą barierą: zablokowany przycisk nie wysyła formularza, a implicit submission
 * (Enter) wymaga pola tekstowego, którego tu nie ma — stąd brak `onSubmit`. Po wysłaniu
 * przeglądarka nawiguje, więc wyspa nie musi nic resetować. Komunikat jest statycznym tekstem pod
 * przyciskiem, nie tooltipem — `Button` ma `disabled:pointer-events-none`.
 */
export function EmbarkGate({ ready, composition }: EmbarkGateProps) {
  return (
    <form method="POST" action="/api/teams" className="flex flex-col items-stretch gap-2">
      <input type="hidden" name={COMPOSITION_FIELD} value={JSON.stringify(composition)} />
      <EmbarkButton ready={ready} />
      <p id={HINT_ID} className={cn("text-center text-sm", ready ? "text-emerald-300" : "text-blue-100/60")}>
        {ready
          ? "All seven competencies are covered."
          : `Every competency needs at least ${COMPETENCY_THRESHOLD} points before the team can embark.`}
      </p>
    </form>
  );
}
