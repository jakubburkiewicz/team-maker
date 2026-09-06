import type { APIRoute } from "astro";

import { getCharacterPool } from "@/lib/character-pool-repo";
import { createClient } from "@/lib/supabase";
import { createTeam } from "@/lib/team-repo";
import {
  BELOW_THRESHOLD_MESSAGE,
  COMPOSITION_FIELD,
  INVALID_PAYLOAD_MESSAGE,
  gateTeamSubmission,
} from "@/lib/team-submission";

/**
 * `POST /api/teams` — trasa tworzenia drużyny (FR-007); od S-05 drugim pisarzem do `teams` jest
 * `POST /api/teams/[id]`, który podmienia skład istniejącego wiersza. Kształt `signin.ts`: natywny
 * formularz, każdy błąd to redirect z `?error=` na `/teams/new`, sukces to redirect na stronę
 * potwierdzenia. Żaden `throw` nie wychodzi z handlera (nieprzechwycony throw w Workerze to 500),
 * żadnego JSON w odpowiedziach.
 *
 * Próg jest sprawdzany tu, na puli z bazy, tą samą bramką `gateTeamSubmission` co w trasie
 * edycji i w wyspie — Guardrail „reguła obowiązuje także poza interfejsem", jedna kopia reguły
 * dla obu kierunków zapisu. Własność wiersza egzekwuje RLS.
 */

function rejectToComposer(context: Parameters<APIRoute>[0], message: string): Response {
  return context.redirect(`/teams/new?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  // Obrona w głąb: `/api/teams` jest chronione przez `isProtectedRoute()` (`src/lib/routes.ts`),
  // więc middleware już przekierował.
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return rejectToComposer(context, "Supabase is not configured");
  }

  // `formData()` rzuca `TypeError` przy ciele innym niż form-urlencoded/multipart — spreparowane
  // żądanie nie może wyjść z handlera jako 500.
  let raw: FormDataEntryValue | null;
  try {
    raw = (await context.request.formData()).get(COMPOSITION_FIELD);
  } catch {
    return rejectToComposer(context, INVALID_PAYLOAD_MESSAGE);
  }
  if (typeof raw !== "string") {
    return rejectToComposer(context, INVALID_PAYLOAD_MESSAGE);
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
      gate.reason.kind === "invalid-payload" ? INVALID_PAYLOAD_MESSAGE : BELOW_THRESHOLD_MESSAGE,
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
