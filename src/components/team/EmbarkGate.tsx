import { Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COMPETENCY_THRESHOLD } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface EmbarkGateProps {
  /** `evaluation.isValid` — brak naruszeń i każda kompetencja na progu. */
  ready: boolean;
}

const HINT_ID = "embark-hint";

/**
 * Bramka „Embark on the job" (FR-018): przycisk zablokowany z komunikatem ogólnym, dopóki
 * werdykt jest negatywny. Komunikat jest statycznym tekstem pod przyciskiem, nie tooltipem —
 * `Button` ma `disabled:pointer-events-none`. Tekst zmienia się przy odblokowaniu, żeby przejście
 * było widoczne także bez koloru. Bez `onClick`: S-02 dostarcza samą bramkę, zapis dołoży S-03.
 */
export function EmbarkGate({ ready }: EmbarkGateProps) {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <Button type="button" variant="cosmic" disabled={!ready} aria-describedby={HINT_ID} className="w-full">
        <Rocket className="size-4" />
        Embark on the job
      </Button>
      <p id={HINT_ID} className={cn("text-center text-sm", ready ? "text-emerald-300" : "text-blue-100/60")}>
        {ready
          ? "All seven competencies are covered."
          : `Every competency needs at least ${COMPETENCY_THRESHOLD} points before the team can embark.`}
      </p>
    </div>
  );
}
