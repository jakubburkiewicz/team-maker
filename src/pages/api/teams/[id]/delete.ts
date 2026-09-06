import type { APIRoute } from "astro";

import { createClient } from "@/lib/supabase";
import { deleteTeam } from "@/lib/team-repo";

/**
 * `POST /api/teams/[id]/delete` — trzeci i ostatni pisarz do `teams` (FR-010). Kształt
 * `api/teams/[id].ts` punkt po punkcie, minus wszystko, co dotyczy składu: natywny formularz,
 * zero JSON w odpowiedziach, każda gałąź kończy się przekierowaniem, żaden `throw` nie wychodzi
 * z handlera — nieprzechwycony throw w Workerze to 500.
 *
 * Usuwanie dostało **własną trasę, nie własny czasownik**: natywny formularz zna wyłącznie GET
 * i POST, a rozgałęzianie `POST /api/teams/[id]` po ukrytym polu przepuściłoby kasowanie przez
 * bramkę progu i przez parsowanie składu. Tutaj nie ma ani jednego, ani drugiego — trasa nie czyta
 * ciała żądania, bo formularz potwierdzenia nie niesie ładunku, i nie zna reguły domenowej.
 * Brak ciała nie osłabia też ochrony przed obcym POST-em: `@supabase/ssr` ustawia ciasteczka
 * `sameSite: "lax"`, więc takie żądanie przychodzi nieuwierzytelnione i kończy się na gałęzi
 * pierwszej (ustalenie z przeglądu S-05). Drugą, niezależną warstwą jest domyślne
 * `security.checkOrigin: true` Astro — 403 dla każdego nie-GET z formularzowym `Content-Type`
 * i obcym `Origin`; to ona trzyma, gdyby aplikacja stanęła na domenie z subdomenami, gdzie
 * „same-site" Lax nie wystarcza. Nie wyłączaj jej w `astro.config.mjs` bez tokena CSRF w zamian.
 *
 * Własność wiersza egzekwuje wyłącznie RLS — polityka `owner can delete teams`
 * (`20260906120000_teams_delete_policy.sql`). Trasa niczego tu nie dubluje.
 */

/**
 * Wspólny tekst dla dwóch **różnych** stanów: `null` z repo („nie ma czego skasować" — nieznane id,
 * cudzy wiersz odcięty przez RLS, nie-UUID) i awarii zapytania. Gracz widzi to samo celowo:
 * gałęzie różnią się logiem, nie komunikatem, bo różnica w odpowiedzi ujawniałaby istnienie
 * cudzego rekordu (US-04).
 *
 * Do oczu gracza ten tekst dociera zresztą tylko w gałęzi awarii zapytania: `/teams/<id>` renderuje
 * slot błędu wyłącznie w gałęzi sukcesu, więc `null` z repo kończy się gołym 404 bez komunikatu.
 * To jest zamierzone — dokładnie to samo daje dziś GET na cudze id, a rozstrzygnięcie
 * „404 vs przekierowanie" należy do S-07.
 */
const DELETE_FAILED_MESSAGE = "Could not delete the team";

export const POST: APIRoute = async (context) => {
  // `params.id` idzie do repo **bez zawężania** — formatu pilnuje `isTeamId`, więc nie-UUID kończy
  // się odesłaniem, a nie błędem Postgresa `22P02`. Do adresu i logów idzie wersja zakodowana: Astro
  // dekoduje ścieżkę przed dopasowaniem trasy, więc `/api/teams/%0A/delete` daje `params.id === "\n"`,
  // a surowa nowa linia w nagłówku `Location` wywraca `new Response` — nieprzechwycony throw to 500.
  // Dla poprawnego UUID kodowanie jest identycznością.
  const id = encodeURIComponent(context.params.id ?? "");
  const reject = (message: string) => `/teams/${id}?error=${encodeURIComponent(message)}`;

  // Obrona w głąb: prefiks `/api/teams` jest w PROTECTED_ROUTES, więc middleware już przekierował.
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(reject("Supabase is not configured"));
  }

  try {
    const team = await deleteTeam(supabase, context.params.id);

    if (team === null) {
      // Zero skasowanych wierszy **nie jest awarią zapytania** — RLS ukrywa cudzy wiersz, więc repo
      // oddaje `null` bez `error`. Log jest jedyną diagnostyką w Workerze, ale to stan spodziewany,
      // nie usterka: stąd `warn`, nie `error`.
      // eslint-disable-next-line no-console
      console.warn(`No team row to delete for POST /api/teams/${id}/delete`);
      return context.redirect(reject(DELETE_FAILED_MESSAGE));
    }

    // Potwierdzenie musi trafić na listę, a nie na stronę drużyny: tamtej strony już nie ma.
    // Baner `?deleted=1` działa też wtedy, gdy zniknęła ostatnia drużyna i lista jest pusta.
    return context.redirect("/teams?deleted=1");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to delete team for POST /api/teams/${id}/delete`, error);
    return context.redirect(reject(DELETE_FAILED_MESSAGE));
  }
};
