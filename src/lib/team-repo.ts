import type { SupabaseClient } from "@supabase/supabase-js";

import type { TeamComposition } from "@/lib/domain";
import { toTeamComposition } from "@/lib/team-submission";

/**
 * Zapis i odczyt nagłówka drużyny w tabeli `teams` — wzorzec `character-pool-repo.ts`: klient
 * **jako argument**, `throw` przy błędzie zapytania, bez importu `@/lib/supabase`, więc moduł nie
 * wciąga `astro:env/server`, a jego czysta część (`isTeamId`) jest testowalna bez Astro i Supabase.
 *
 * Własność wierszy egzekwuje RLS (`20260905185700_teams_schema.sql`): `insert` przechodzi tylko
 * z `user_id = auth.uid()`, `select` widzi tylko własne wiersze, `update` — dołożone przez
 * `20260906090000_teams_update_policy.sql` — zmienia wyłącznie własne, a `delete` — dołożone przez
 * `20260906120000_teams_delete_policy.sql` — kasuje wyłącznie własne. Repo niczego tu nie dubluje:
 * żadna funkcja nie filtruje po `user_id`, bo drugi warunek sugerowałby, że RLS sam nie wystarcza.
 */

export interface TeamSummary {
  id: string;
  name: string;
}

/** Wiersz `public.teams` w kształcie zwracanym przez `select("id, name")`. */
interface TeamSummaryRow {
  id: string;
  name: string;
}

const SUMMARY_SELECT = "id, name";

/** Pozycja listy `/teams` — nagłówek drużyny bez `composition`, którego lista nie rysuje. */
export interface TeamListItem {
  id: string;
  name: string;
  /** `created_at` w kształcie zwróconym przez PostgREST (ISO-8601); formatuje wywołujący. */
  createdAt: string;
}

/** Wiersz `public.teams` w kształcie zwracanym przez `select("id, name, created_at")`. */
interface TeamListRow {
  id: string;
  name: string;
  created_at: string;
}

const LIST_SELECT = "id, name, created_at";

/** Zapisana drużyna razem ze składem — pod widok szczegółów `/teams/[id]`. */
export interface TeamDetail {
  id: string;
  name: string;
  composition: TeamComposition;
}

/**
 * Wiersz `public.teams` ze składem. `composition` jest `unknown`, nie `TeamComposition`:
 * kolumna to `jsonb` bez ograniczenia kształtu, więc typ musi być zdobyty
 * przez `toTeamComposition`, a nie zadeklarowany.
 */
interface TeamDetailRow {
  id: string;
  name: string;
  composition: unknown;
}

const DETAIL_SELECT = "id, name, composition";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Czysta kontrola formatu UUID — zawęża typ dla wywołującego. Przyjmuje `undefined`, bo
 * `Astro.params.id` ma typ `string | undefined`; strona woła repo bez zawężania i bez rzutowania.
 */
export function isTeamId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/**
 * Wstawia wiersz i zwraca `id` oraz nazwę wygenerowaną przez bazę (`default` kolumny `name` —
 * nie podawana). `returning` przechodzi przez politykę `select`, więc po udanym zapisie wiersz
 * zawsze wraca. Rzuca przy błędzie zapytania.
 */
export async function createTeam(
  supabase: SupabaseClient,
  input: { userId: string; composition: TeamComposition },
): Promise<TeamSummary> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ user_id: input.userId, composition: input.composition })
    .select(SUMMARY_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to save team: ${error.message}`, { cause: error });
  }

  const row: TeamSummaryRow = data;

  return { id: row.id, name: row.name };
}

/**
 * Podmienia skład istniejącej drużyny (FR-009) i zwraca jej nagłówek, albo `null`, gdy nie ma
 * czego zapisać. Rzuca wyłącznie przy błędzie zapytania.
 *
 * Ładunek to **wyłącznie `{ composition }`** — bez `name`, `user_id` i `id`. Nazwa-hash jest
 * nieedytowalna (FR-011), a właściciel i identyfikator nie zmieniają się nigdy. Druga,
 * niezależna bariera stoi w bazie: `grant update (composition)`
 * (`20260906090000_teams_update_policy.sql`) nadaje przywilej **kolumnowo**, więc zapis
 * innej kolumny kończy się błędem uprawnień, nie cichym pominięciem.
 *
 * Trzy wyniki, których wywołujący nie może pomylić: rekord (zapis się udał), `null`
 * (`id` nie jest UUID **albo** wiersz nie wrócił — nieznane id i cudza drużyna odcięta przez RLS,
 * nierozróżnialnie, dokładnie jak `getTeamSummary`), `throw` (awaria zapytania). Zero zmienionych
 * wierszy **nie jest awarią**: RLS ukrywa cudzy wiersz, więc `update … returning` zwraca wtedy
 * `null` bez `error`.
 */
export async function updateTeam(
  supabase: SupabaseClient,
  input: { id: string | undefined; composition: TeamComposition },
): Promise<TeamSummary | null> {
  if (!isTeamId(input.id)) {
    return null;
  }

  const { data, error } = await supabase
    .from("teams")
    .update({ composition: input.composition })
    .eq("id", input.id)
    .select(SUMMARY_SELECT)
    .maybeSingle();

  if (error) {
    // `error.message` musi przejść dalej w całości: komunikat kolumnowego grantu z Postgresa jest
    // mało czytelny, a log jest jedyną diagnostyką w Workerze.
    throw new Error(`Failed to update team ${input.id}: ${error.message}`, { cause: error });
  }

  const row: TeamSummaryRow | null = data;

  return row === null ? null : { id: row.id, name: row.name };
}

/**
 * Kasuje drużynę (FR-010) i zwraca jej nagłówek, albo `null`, gdy nie ma czego skasować. Rzuca
 * wyłącznie przy błędzie zapytania. Usunięcie jest nieodwracalne — Non-Goal PRD „kosz
 * i przywracanie" — a jedyną ochroną jest okno potwierdzenia w interfejsie, nie ta funkcja.
 *
 * Trzy wyniki, których wywołujący nie może pomylić, te same co w `updateTeam`: rekord (wiersz
 * zniknął), `null` (`id` nie jest UUID **albo** wiersz nie wrócił — nieznane id i cudza drużyna
 * odcięta przez RLS, nierozróżnialnie), `throw` (awaria zapytania). Zero skasowanych wierszy
 * **nie jest awarią**: RLS ukrywa cudzy wiersz, więc `delete … returning` zwraca wtedy `null`
 * bez `error`.
 *
 * To, że skasowany wiersz w ogóle wraca, zawdzięczamy polityce `select` — `returning` przechodzi
 * przez nią tak samo jak przy `insert` i `update` (`20260906120000_teams_delete_policy.sql`).
 * Żadnego filtra po `user_id`: własność zostaje przy polityce `delete`.
 */
export async function deleteTeam(supabase: SupabaseClient, id: string | undefined): Promise<TeamSummary | null> {
  if (!isTeamId(id)) {
    return null;
  }

  const { data, error } = await supabase.from("teams").delete().eq("id", id).select(SUMMARY_SELECT).maybeSingle();

  if (error) {
    throw new Error(`Failed to delete team ${id}: ${error.message}`, { cause: error });
  }

  const row: TeamSummaryRow | null = data;

  return row === null ? null : { id: row.id, name: row.name };
}

/**
 * `null`, gdy wiersza nie ma lub RLS go ukrywa (cudza drużyna), a także gdy `id` nie jest UUID —
 * bez tej kontroli Postgres rzuca `22P02` przy porównaniu z kolumną `uuid` i strona pokazałaby
 * stan awarii zamiast 404. Rzuca przy błędzie zapytania.
 */
export async function getTeamSummary(supabase: SupabaseClient, id: string | undefined): Promise<TeamSummary | null> {
  if (!isTeamId(id)) {
    return null;
  }

  const { data, error } = await supabase.from("teams").select(SUMMARY_SELECT).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load team ${id}: ${error.message}`, { cause: error });
  }

  const row: TeamSummaryRow | null = data;

  return row === null ? null : { id: row.id, name: row.name };
}

/**
 * Własne drużyny, najnowsza na górze. Własność egzekwuje polityka `select` (RLS), więc repo nie
 * filtruje po `user_id` — dołożenie tu drugiego warunku sugerowałoby, że RLS sam nie wystarcza.
 *
 * **Pusta lista jest legalnym stanem** i wraca jako `[]` — inaczej niż w `getCharacterPool`, gdzie
 * zero wierszy oznacza awarię: nowe konto po prostu nie ma jeszcze drużyny (US-01, stan pusty).
 * Rzuca wyłącznie przy błędzie zapytania.
 */
export async function listTeams(supabase: SupabaseClient): Promise<readonly TeamListItem[]> {
  const { data, error } = await supabase.from("teams").select(LIST_SELECT).order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list teams: ${error.message}`, { cause: error });
  }

  const rows: readonly TeamListRow[] = data;

  return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
}

/**
 * Drużyna ze składem albo `null` — nierozróżnialnie dla nieznanego id, cudzego wiersza (RLS)
 * i nie-UUID, dokładnie jak `getTeamSummary`.
 *
 * `composition` poza kształtem `[{ characterId, perkIds }]` **rzuca**, a nie zwraca `null`:
 * przy jedynym pisarzu `POST /api/teams` to stan niemożliwy, więc należy do tej samej kategorii
 * co pusta pula w `character-pool-repo.ts` — awaria do zdiagnozowania, nie „drużyny nie ma".
 * Czy skład da się **pokazać z aktualną pulą**, rozstrzyga osobno `resolveSavedTeam`; repo zna
 * wyłącznie kształt.
 */
export async function getTeamDetail(supabase: SupabaseClient, id: string | undefined): Promise<TeamDetail | null> {
  if (!isTeamId(id)) {
    return null;
  }

  const { data, error } = await supabase.from("teams").select(DETAIL_SELECT).eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to load team ${id}: ${error.message}`, { cause: error });
  }

  const row: TeamDetailRow | null = data;

  if (row === null) {
    return null;
  }

  const composition = toTeamComposition(row.composition);

  if (composition === null) {
    throw new Error(`Team ${id} has a composition outside the { characterId, perkIds }[] shape`);
  }

  return { id: row.id, name: row.name, composition };
}
