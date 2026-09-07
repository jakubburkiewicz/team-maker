import type { SupabaseClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CharacterRow } from "@/lib/character-pool-repo";
import { CHARACTER_POOL } from "@/lib/domain";
import { BELOW_THRESHOLD_MESSAGE, COMPOSITION_FIELD } from "@/lib/team-submission";

/**
 * Tor zapisu składu wykonany w Node — pierwszy test tego repozytorium, który **uruchamia** trasę
 * API zamiast sprawdzać moduł, który trasa woła.
 *
 * Dowodzi Guardraila PRD „zapisana drużyna zawsze spełnia próg" i „limity składu nie do obejścia"
 * po stronie serwera: skład odrzucony przez `gateTeamSubmission` **nie zostawia wpisu w dzienniku
 * zapisów**. Wyrocznią jest skutek (czy wiersz powstał), nigdy `scores` — te odzwierciedlają surowy
 * wybór, także odrzucony przez limity (`evaluate-team.ts` → `TeamEvaluation.scores`).
 *
 * **Dlaczego plik leży w `src/lib/`, a nie obok trasy**: Astro traktuje każdy `.ts` w `src/pages/`
 * jako endpoint, więc `src/pages/api/teams/index.test.ts` stałby się trasą `/api/teams/index.test`
 * i wszedł do builda produkcyjnego.
 *
 * **Czystość testu (AGENTS.md → Hard rules)**: prawdziwy `@/lib/supabase` nigdy się nie ewaluuje —
 * `vi.mock` podmienia go fabryką z `vi.hoisted`, więc `astro:env/server` nie jest rozwiązywany,
 * a prawdziwy klient nie powstaje. Trasa jest ładowana `await import(...)` w ciele testu, żeby
 * atrapa była skonfigurowana przed ewaluacją modułu.
 */

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn<() => SupabaseClient | null>(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));

/**
 * Każdy nieznany człon łańcucha **rzuca**. To jest różnica między atrapą a dziurą: atrapa
 * przepuszczająca dowolne zapytanie cicho rozjeżdża się z prawdziwą bazą.
 */
function strict<T extends object>(label: string, shape: T): T {
  return new Proxy(shape, {
    get(target, property, receiver) {
      if (typeof property === "symbol" || property in target) {
        return Reflect.get(target, property, receiver) as unknown;
      }
      throw new Error(`Fake Supabase client: unexpected member "${property}" on ${label}`);
    },
  });
}

interface QueryResult<T> {
  data: T;
  error: null;
}

/** `from("characters").select(...).order(...).order(...)` + `await` (`character-pool-repo.ts`). */
interface PoolQuery extends PromiseLike<QueryResult<readonly CharacterRow[]>> {
  select: (columns: string) => PoolQuery;
  order: (column: string, options?: { referencedTable?: string }) => PoolQuery;
}

interface TeamRow {
  id: string;
  name: string;
}

/** `.insert(row).select(...).single()` — kształt i **kolejność** z `team-repo.ts` → `createTeam`. */
interface InsertSelected {
  single: () => PromiseLike<QueryResult<TeamRow>>;
}
interface InsertQuery {
  select: (columns: string) => InsertSelected;
}

/** `.update(row).eq(...).select(...).maybeSingle()` — z `team-repo.ts` → `updateTeam`. */
interface UpdateSelected {
  maybeSingle: () => PromiseLike<QueryResult<TeamRow | null>>;
}
interface UpdateFiltered {
  select: (columns: string) => UpdateSelected;
}
interface UpdateQuery {
  eq: (column: string, value: string) => UpdateFiltered;
}

interface TeamsTable {
  insert: (row: Record<string, unknown>) => InsertQuery;
  update: (row: Record<string, unknown>) => UpdateQuery;
}

/** Wpis dziennika zapisów — jedyna wyrocznia „czy skład został utrwalony". */
interface WriteLogEntry {
  operation: "insert" | "update";
  row: Record<string, unknown>;
}

interface FakeSupabase {
  /** Klient w kształcie, w jakim widzą go moduły `src/lib/`; prawdziwy nie powstaje nigdy. */
  client: SupabaseClient;
  writes: WriteLogEntry[];
}

/**
 * Pula z `CHARACTER_POOL`, nie z literałów — dopisanie postaci nie wywraca testu w ciszy.
 * `sort_order` pochodzi z indeksu, bo kolejność w stałej jest kolejnością w bazie.
 */
function poolRows(): CharacterRow[] {
  return CHARACTER_POOL.map((character, index) => ({
    id: character.id,
    name: character.name,
    description: character.description,
    specialization: character.specialization,
    sort_order: index,
    perks: character.perks.map((perk, perkIndex) => ({
      id: perk.id,
      name: perk.name,
      competency: perk.competency,
      sort_order: perkIndex,
    })),
  }));
}

/** Nagłówek, który baza oddaje po udanym zapisie — `id` jest UUID-em, bo trafia do adresu. */
const SAVED_TEAM: TeamRow = { id: "3f2b8c14-9d6e-4a70-b1c5-8e2d47a90b3f", name: "0x7f3a91" };

function fakeSupabase(): FakeSupabase {
  const writes: WriteLogEntry[] = [];
  const poolResult = Promise.resolve<QueryResult<readonly CharacterRow[]>>({ data: poolRows(), error: null });

  const pool: PoolQuery = strict("characters query", {
    select: () => pool,
    order: () => pool,
    then: poolResult.then.bind(poolResult),
  });

  const teams: TeamsTable = strict("teams table", {
    insert: (row: Record<string, unknown>): InsertQuery => {
      writes.push({ operation: "insert", row });
      return strict("teams insert", {
        select: (): InsertSelected =>
          strict("teams insert select", {
            single: () => Promise.resolve<QueryResult<TeamRow>>({ data: SAVED_TEAM, error: null }),
          }),
      });
    },
    update: (row: Record<string, unknown>): UpdateQuery => {
      writes.push({ operation: "update", row });
      return strict("teams update", {
        eq: (): UpdateFiltered =>
          strict("teams update eq", {
            select: (): UpdateSelected =>
              strict("teams update select", {
                maybeSingle: () => Promise.resolve<QueryResult<TeamRow | null>>({ data: SAVED_TEAM, error: null }),
              }),
          }),
      });
    },
  });

  const client = {
    from: (table: string): PoolQuery | TeamsTable => {
      if (table === "characters") return pool;
      if (table === "teams") return teams;
      throw new Error(`Fake Supabase client: unexpected table "${table}"`);
    },
  };

  return { client: client as unknown as SupabaseClient, writes };
}

const USER_ID = "9a1c4e70-52bd-4f18-8c33-7d0e6b2f5a41";

/** Prawdziwy `Request` z ciałem form-urlencoded, żeby `formData()` w trasie był prawdziwy. */
function saveRequest(composition: string): Request {
  return new Request("https://team-maker.test/api/teams", {
    method: "POST",
    body: new URLSearchParams({ [COMPOSITION_FIELD]: composition }),
  });
}

/** Atrapa `APIContext` — sonda potwierdziła, że handler nie sięga po nic ponadto. */
function routeContext(request: Request, params: { id?: string } = {}): Parameters<APIRoute>[0] {
  const context = {
    locals: { user: { id: USER_ID } },
    request,
    cookies: {},
    params,
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  };

  return context as unknown as Parameters<APIRoute>[0];
}

describe("POST /api/teams — bariera zapisu", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("skład poniżej progu nie zostawia zapisu i wraca odesłaniem z ?error=", async () => {
    const supabase = fakeSupabase();
    createClientMock.mockReturnValue(supabase.client);

    const { POST } = await import("@/pages/api/teams/index");
    const response = await POST(routeContext(saveRequest("[]")));

    expect(supabase.writes).toEqual([]);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`/teams/new?error=${encodeURIComponent(BELOW_THRESHOLD_MESSAGE)}`);
  });
});
