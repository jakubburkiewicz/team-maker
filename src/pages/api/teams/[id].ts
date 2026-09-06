import type { APIRoute } from "astro";

import { getCharacterPool } from "@/lib/character-pool-repo";
import { createClient } from "@/lib/supabase";
import { updateTeam } from "@/lib/team-repo";
import {
  BELOW_THRESHOLD_MESSAGE,
  COMPOSITION_FIELD,
  INVALID_PAYLOAD_MESSAGE,
  gateTeamSubmission,
} from "@/lib/team-submission";

/**
 * `POST /api/teams/[id]` — drugi i ostatni pisarz do `teams` (FR-009). Kształt `api/teams/index.ts`
 * punkt po punkcie, z jedną różnicą: celem odesłania jest `/teams/<id>`, nie `/teams/new`.
 * Natywny formularz, każda odmowa to przekierowanie z `?error=`, żadnego JSON w odpowiedziach.
 * Żaden `throw` nie wychodzi z handlera — nieprzechwycony throw w Workerze to 500.
 *
 * Próg jest sprawdzany **tą samą** bramką `gateTeamSubmission` co przy tworzeniu, na puli z bazy.
 * Trasa nie dostaje własnej kopii reguły ani własnego progu, tylko inny cel zapisu — to jest
 * odpowiedź na ryzyko „fragment sprawdzający próg tylko przy pierwszym zapisie łamie Guardrail
 * tylnymi drzwiami". Nazwa-hash nie wchodzi do ładunku (FR-011); własność wiersza egzekwuje RLS.
 */

/**
 * Wspólny tekst dla dwóch **różnych** stanów: `null` z repo („nie ma czego zapisać" — nieznane id,
 * cudzy wiersz odcięty przez RLS, nie-UUID) i awarii zapytania. Gracz widzi to samo celowo:
 * gałęzie różnią się logiem, nie komunikatem, bo różnica w odpowiedzi ujawniałaby istnienie
 * cudzego rekordu (US-04).
 */
const SAVE_FAILED_MESSAGE = "Could not save the team";

export const POST: APIRoute = async (context) => {
  // `params.id` idzie do repo **bez zawężania** — formatu pilnuje `isTeamId`, więc nie-UUID kończy
  // się odesłaniem, a nie błędem Postgresa `22P02`. Do budowy adresu `?? ""`, jak
  // `src/pages/teams/[id]/embark.astro:27`.
  const id = context.params.id ?? "";
  const reject = (message: string) => `/teams/${id}?error=${encodeURIComponent(message)}`;

  // Obrona w głąb: prefiks `/api/teams` jest w PROTECTED_ROUTES, więc middleware już przekierował.
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(reject("Supabase is not configured"));
  }

  // `formData()` rzuca `TypeError` przy ciele innym niż form-urlencoded/multipart — spreparowane
  // żądanie nie może wyjść z handlera jako 500.
  let raw: FormDataEntryValue | null;
  try {
    raw = (await context.request.formData()).get(COMPOSITION_FIELD);
  } catch {
    return context.redirect(reject(INVALID_PAYLOAD_MESSAGE));
  }
  if (typeof raw !== "string") {
    return context.redirect(reject(INVALID_PAYLOAD_MESSAGE));
  }

  let pool;
  try {
    pool = await getCharacterPool(supabase);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load character pool for POST /api/teams/${id}`, error);
    return context.redirect(reject("Character pool is unavailable"));
  }

  const gate = gateTeamSubmission(raw, pool);
  if (!gate.ok) {
    const message = gate.reason.kind === "invalid-payload" ? INVALID_PAYLOAD_MESSAGE : BELOW_THRESHOLD_MESSAGE;
    return context.redirect(reject(message));
  }

  try {
    const team = await updateTeam(supabase, { id: context.params.id, composition: gate.composition });

    if (team === null) {
      // Zero zmienionych wierszy **nie jest awarią zapytania** — RLS ukrywa cudzy wiersz, więc
      // repo oddaje `null` bez `error`. Log jest jedyną diagnostyką w Workerze, ale to stan
      // spodziewany, nie usterka: stąd `warn`, nie `error`.
      // eslint-disable-next-line no-console
      console.warn(`No team row to update for POST /api/teams/${id}`);
      return context.redirect(reject(SAVE_FAILED_MESSAGE));
    }

    return context.redirect(`/teams/${team.id}?saved=1`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to update team for POST /api/teams/${id}`, error);
    return context.redirect(reject(SAVE_FAILED_MESSAGE));
  }
};
