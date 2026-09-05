import type { SupabaseClient } from "@supabase/supabase-js";

import type { TeamComposition } from "@/lib/domain";

/**
 * Zapis i odczyt nagłówka drużyny w tabeli `teams` — wzorzec `character-pool-repo.ts`: klient
 * **jako argument**, `throw` przy błędzie zapytania, bez importu `@/lib/supabase`, więc moduł nie
 * wciąga `astro:env/server`, a jego czysta część (`isTeamId`) jest testowalna bez Astro i Supabase.
 *
 * Własność wierszy egzekwuje RLS (`20260905185700_teams_schema.sql`): `insert` przechodzi tylko
 * z `user_id = auth.uid()`, `select` widzi tylko własne wiersze. Repo niczego tu nie dubluje.
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
