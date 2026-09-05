import type { APIRoute } from "astro";

import { getCharacterPool } from "@/lib/character-pool-repo";
import { COMPETENCY_THRESHOLD } from "@/lib/domain";
import { createClient } from "@/lib/supabase";
import { createTeam } from "@/lib/team-repo";
import { COMPOSITION_FIELD, gateTeamSubmission } from "@/lib/team-submission";

/**
 * `POST /api/teams` — jedyny pisarz do `teams` w aplikacji (FR-007). Kształt `signin.ts`: natywny
 * formularz, każdy błąd to redirect z `?error=` na `/teams/new`, sukces to redirect na stronę
 * potwierdzenia. Żaden `throw` nie wychodzi z handlera (nieprzechwycony throw w Workerze to 500),
 * żadnego JSON w odpowiedziach.
 *
 * Próg jest sprawdzany tu, na puli z bazy, tym samym `evaluateTeam` co w wyspie — Guardrail
 * „reguła obowiązuje także poza interfejsem". Własność wiersza egzekwuje RLS.
 */

function rejectToComposer(context: Parameters<APIRoute>[0], message: string): Response {
  return context.redirect(`/teams/new?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  // Obrona w głąb: `/api/teams` jest w PROTECTED_ROUTES, więc middleware już przekierował.
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return rejectToComposer(context, "Supabase is not configured");
  }

  const form = await context.request.formData();
  const raw = form.get(COMPOSITION_FIELD);
  if (typeof raw !== "string") {
    return rejectToComposer(context, "Invalid team payload");
  }

  let pool;
  try {
    pool = await getCharacterPool(supabase);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to load character pool for POST /api/teams", error);
    return rejectToComposer(context, "Character pool is unavailable");
  }

  const gate = gateTeamSubmission(raw, pool);
  if (!gate.ok) {
    return rejectToComposer(
      context,
      gate.reason.kind === "invalid-payload"
        ? "Invalid team payload"
        : `Every competency needs at least ${COMPETENCY_THRESHOLD} points before the team can embark.`,
    );
  }

  try {
    const team = await createTeam(supabase, { userId: user.id, composition: gate.composition });
    return context.redirect(`/teams/${team.id}/embark`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to save team for POST /api/teams", error);
    return rejectToComposer(context, "Could not save the team");
  }
};
