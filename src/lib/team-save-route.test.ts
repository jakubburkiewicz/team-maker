import type { SupabaseClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CharacterRow } from "@/lib/character-pool-repo";
import { CHARACTER_POOL, MAX_TEAM_SIZE, evaluateTeam, type RuleViolation, type TeamComposition } from "@/lib/domain";
import { findThresholdSolution } from "@/lib/domain/solvability";
import { BELOW_THRESHOLD_MESSAGE, COMPOSITION_FIELD, INVALID_PAYLOAD_MESSAGE } from "@/lib/team-submission";

/**
 * Tor zapisu składu wykonany w Node — pierwszy test tego repozytorium, który **uruchamia** trasę
 * API zamiast sprawdzać moduł, który trasa woła.
 *
 * Dowodzi Guardraili PRD „zapisana drużyna zawsze spełnia próg" (ryzyko #1) i „limity składu nie
 * do obejścia" (ryzyko #6) po stronie serwera: skład odrzucony przez `gateTeamSubmission` **nie
 * zostawia wpisu w dzienniku zapisów**. Wyrocznią jest skutek (czy wiersz powstał), nigdy sumy
 * punktowe — te odzwierciedlają surowy wybór, także odrzucony przez limity
 * (`evaluate-team.ts` → `TeamEvaluation`), więc trzeci perk i powtórzona postać podnoszą je mimo
 * naruszenia.
 *
 * **Dlaczego plik leży w `src/lib/`, a nie obok trasy**: Astro traktuje każdy `.ts` w `src/pages/`
 * jako endpoint, więc `src/pages/api/teams/index.test.ts` stałby się trasą `/api/teams/index.test`
 * i wszedł do builda produkcyjnego.
 *
 * **Czystość testu (AGENTS.md → Hard rules)**: prawdziwy `@/lib/supabase` nigdy się nie ewaluuje —
 * `vi.mock` podmienia go fabryką z `vi.hoisted`, więc `astro:env/server` nie jest rozwiązywany,
 * a prawdziwy klient nie powstaje. Trasy są ładowane `await import(...)` w ciele testu, żeby
 * atrapa była skonfigurowana przed ewaluacją modułu.
 */

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn<() => SupabaseClient | null>(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));

/* ------------------------------------------------------------------ osprzęt */

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
  /** Awaria zapytania. Repo rozróżnia ją od „zero wierszy" — zero wierszy nie jest awarią. */
  error: { message: string } | null;
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
  /**
   * Ile razy trasa sięgnęła po tabelę `teams`. Zero dowodzi odcięcia **przed** zapytaniem —
   * `updateTeam` odrzuca nie-UUID przez `isTeamId`, zamiast wysyłać go do Postgresa (`22P02`).
   */
  teamsQueries: () => number;
}

interface FakeOptions {
  /** Zapytanie o pulę kończy się błędem, więc `getCharacterPool` rzuca. */
  poolFails?: boolean;
  /**
   * Wiersz oddany przez `update … returning`. `null` to **stan**, nie awaria: nieznane id albo
   * cudzy wiersz odcięty przez RLS — nierozróżnialnie (US-04).
   */
  updatedTeam?: TeamRow | null;
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

function fakeSupabase(options: FakeOptions = {}): FakeSupabase {
  const writes: WriteLogEntry[] = [];
  const updatedTeam = options.updatedTeam === undefined ? SAVED_TEAM : options.updatedTeam;
  let teamsQueries = 0;

  const poolResult = Promise.resolve<QueryResult<readonly CharacterRow[]>>(
    options.poolFails === true
      ? { data: [], error: { message: "connection reset" } }
      : { data: poolRows(), error: null },
  );

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
                maybeSingle: () => Promise.resolve<QueryResult<TeamRow | null>>({ data: updatedTeam, error: null }),
              }),
          }),
      });
    },
  });

  const client = {
    from: (table: string): PoolQuery | TeamsTable => {
      if (table === "characters") return pool;
      if (table === "teams") {
        teamsQueries += 1;
        return teams;
      }
      throw new Error(`Fake Supabase client: unexpected table "${table}"`);
    },
  };

  return { client: client as unknown as SupabaseClient, writes, teamsQueries: () => teamsQueries };
}

const USER_ID = "9a1c4e70-52bd-4f18-8c33-7d0e6b2f5a41";

const ROUTE_URL = "https://team-maker.test/api/teams";

/** Prawdziwy `Request` z ciałem form-urlencoded, żeby `formData()` w trasie był prawdziwy. */
function saveRequest(composition: string): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    body: new URLSearchParams({ [COMPOSITION_FIELD]: composition }),
  });
}

/** Formularz bez pola składu — `formData().get(COMPOSITION_FIELD)` oddaje `null`, nie tekst. */
function requestWithoutCompositionField(): Request {
  return new Request(ROUTE_URL, { method: "POST", body: new URLSearchParams() });
}

/** Ciało, na którym `formData()` **rzuca** `TypeError` — spreparowane żądanie spoza formularza. */
function jsonBodyRequest(): Request {
  return new Request(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [COMPOSITION_FIELD]: [] }),
  });
}

interface ContextOptions {
  request: Request;
  params: { id?: string };
  user: { id: string } | null;
}

/** Atrapa `APIContext` — sonda potwierdziła, że handler nie sięga po nic ponadto. */
function routeContext(options: ContextOptions): Parameters<APIRoute>[0] {
  const context = {
    locals: { user: options.user },
    request: options.request,
    cookies: {},
    params: options.params,
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  };

  return context as unknown as Parameters<APIRoute>[0];
}

/* ------------------------------------------------------- tabela tras zapisu */

interface SaveRouteModule {
  POST: APIRoute;
}

interface SaveRoute {
  label: string;
  load: () => Promise<SaveRouteModule>;
  params: { id?: string };
  /** Prefiks `Location` każdej odmowy z tej trasy — cele różnią się między trasami. */
  rejectPrefix: string;
  /** `Location` po udanym zapisie. */
  successLocation: string;
  /** Wpis, jakiego oczekujemy w dzienniku po przyjęciu składu. */
  expectedWrite: (composition: TeamComposition) => WriteLogEntry;
}

/**
 * Obaj pisarze do `teams`. Ryzyka #1 i #6 są związane **osobno na każdej trasie** — próg
 * sprawdzany tylko przy pierwszym zapisie łamałby Guardrail tylnymi drzwiami.
 */
const SAVE_ROUTES: readonly SaveRoute[] = [
  {
    label: "POST /api/teams",
    load: () => import("@/pages/api/teams/index"),
    params: {},
    rejectPrefix: "/teams/new?error=",
    successLocation: `/teams/${SAVED_TEAM.id}/embark`,
    expectedWrite: (composition) => ({ operation: "insert", row: { user_id: USER_ID, composition } }),
  },
  {
    label: "POST /api/teams/[id]",
    load: () => import("@/pages/api/teams/[id]"),
    params: { id: SAVED_TEAM.id },
    rejectPrefix: `/teams/${SAVED_TEAM.id}?error=`,
    successLocation: `/teams/${SAVED_TEAM.id}?saved=1`,
    expectedWrite: (composition) => ({ operation: "update", row: { composition } }),
  },
];

/* ------------------------------------------------------------------ składy */

/**
 * Skład domykający próg, wyliczony solverem na pełnej puli — przypadek pozytywny obu tras.
 * Nigdy nie wpisany z palca: dopisanie postaci do puli nie unieważnia go w ciszy.
 */
function thresholdSolution(): TeamComposition {
  const solution = findThresholdSolution(CHARACTER_POOL);

  if (solution === null) {
    throw new Error("CHARACTER_POOL nie domyka progu — patrz src/lib/domain/character-pool.test.ts");
  }

  return solution;
}

/**
 * Ten sam solver puszczony na **najkrótszym prefiksie puli**, jaki domyka próg.
 *
 * Powód jest wprost o izolacji: `findThresholdSolution(CHARACTER_POOL)` oddaje skład
 * sześcioosobowy, czyli pełny, więc doklejenie do niego siódmego wpisu wyzwoliłoby
 * `too-many-members` **razem** z badanym naruszeniem i przypadek przestałby wiązać ten jeden
 * limit. Krótszy skład zostawia wolne miejsca, dzięki czemu każde naruszenie doklejamy osobno,
 * jako czystą nadwyżkę — a `missing` pozostaje wyzerowane, więc odmowa pochodzi z limitu,
 * nie z progu. Warunek jest sprawdzany asercją, nie założony (patrz „kardynalność tabel").
 */
function compactSolution(): TeamComposition {
  for (let size = 1; size <= CHARACTER_POOL.length; size += 1) {
    const solution = findThresholdSolution(CHARACTER_POOL.slice(0, size));

    if (solution !== null) {
      return solution;
    }
  }

  throw new Error("CHARACTER_POOL nie domyka progu — patrz src/lib/domain/character-pool.test.ts");
}

const SOLUTION = thresholdSolution();
const VIOLATION_BASE = compactSolution();

/** Postacie spoza bazy — doklejane wpisy biorą się stąd, żeby nie wywołać `duplicate-character`. */
const OUTSIDERS = CHARACTER_POOL.filter(
  (character) => !VIOLATION_BASE.some((member) => member.characterId === character.id),
);

/** Identyfikator spoza puli — jego nieobecność w `CHARACTER_POOL` jest sprawdzana asercją. */
const UNKNOWN_CHARACTER_ID = "character-outside-the-pool";

/**
 * Sześć różnych postaci bez ani jednego perka. Nigdy nie domyka progu i nie jest to obserwacja
 * z kodu, tylko własność liczbowa z PRD → Business Logic: sześciu członków wnosi co najwyżej
 * sześć specjalizacji przy siedmiu kompetencjach.
 */
function sixSpecializationsOnly(): TeamComposition {
  return CHARACTER_POOL.slice(0, MAX_TEAM_SIZE).map((character) => ({ characterId: character.id, perkIds: [] }));
}

interface ViolationCase {
  kind: RuleViolation["kind"];
  build: () => TeamComposition;
}

/**
 * Sześć naruszeń — tyle, ile wariantów ma `RuleViolation`. Każde doklejone do składu z solvera
 * jako nadwyżka, żeby przypadek izolował **jeden** limit.
 */
const VIOLATION_CASES: readonly ViolationCase[] = [
  {
    kind: "too-many-members",
    build: () => [
      ...VIOLATION_BASE,
      ...OUTSIDERS.slice(0, MAX_TEAM_SIZE + 1 - VIOLATION_BASE.length).map((character) => ({
        characterId: character.id,
        perkIds: [],
      })),
    ],
  },
  {
    kind: "duplicate-character",
    build: () => [...VIOLATION_BASE, { characterId: VIOLATION_BASE[0].characterId, perkIds: [] }],
  },
  {
    kind: "too-many-perks",
    build: () => [
      ...VIOLATION_BASE,
      { characterId: OUTSIDERS[0].id, perkIds: OUTSIDERS[0].perks.map((perk) => perk.id) },
    ],
  },
  {
    kind: "duplicate-perk",
    build: () => [
      ...VIOLATION_BASE,
      { characterId: OUTSIDERS[0].id, perkIds: [OUTSIDERS[0].perks[0].id, OUTSIDERS[0].perks[0].id] },
    ],
  },
  {
    kind: "unknown-character",
    build: () => [...VIOLATION_BASE, { characterId: UNKNOWN_CHARACTER_ID, perkIds: [] }],
  },
  {
    kind: "unknown-perk",
    build: () => [...VIOLATION_BASE, { characterId: OUTSIDERS[0].id, perkIds: [OUTSIDERS[1].perks[0].id] }],
  },
];

/* ------------------------------------------------------------ uruchamianie */

interface RouteRun {
  response: Response;
  writes: WriteLogEntry[];
  teamsQueries: number;
}

interface RunOptions {
  request?: Request;
  params?: { id?: string };
  /** `null` → brak sesji; trasa ma odesłać na logowanie, nie tworzyć klienta. */
  user?: { id: string } | null;
  fake?: FakeOptions;
  /** `true` → `createClient` oddaje `null`, czyli brak konfiguracji Supabase. */
  unconfigured?: boolean;
}

async function run(route: SaveRoute, options: RunOptions = {}): Promise<RouteRun> {
  const supabase = fakeSupabase(options.fake);
  createClientMock.mockReturnValue(options.unconfigured === true ? null : supabase.client);

  const { POST } = await route.load();
  const response = await POST(
    routeContext({
      request: options.request ?? saveRequest("[]"),
      params: options.params ?? route.params,
      user: options.user === undefined ? { id: USER_ID } : options.user,
    }),
  );

  return { response, writes: supabase.writes, teamsQueries: supabase.teamsQueries() };
}

function post(route: SaveRoute, payload: string): Promise<RouteRun> {
  return run(route, { request: saveRequest(payload) });
}

function rejectionLocation(route: SaveRoute, message: string): string {
  return `${route.rejectPrefix}${encodeURIComponent(message)}`;
}

/**
 * Teksty odmowy, których `src/pages/` **nie eksportuje**: `SAVE_FAILED_MESSAGE` jest prywatną
 * stałą `[id].ts`, a pozostałe dwa są literałami w ciele obu tras. Zakres tej zmiany zabrania
 * edycji `src/pages/`, więc test trzyma je jako **świadomą drugą kopię literału** — nazwaną tu
 * wprost, żeby przegląd implementacji nie zgłosił jej jako dryfu. Wyniesienie ich do
 * `@/lib/team-submission` jest kandydatem na osobną zmianę.
 */
const UNEXPORTED_MESSAGES = {
  supabaseMisconfigured: "Supabase is not configured",
  poolUnavailable: "Character pool is unavailable",
  saveFailed: "Could not save the team",
} as const;

/* ------------------------------------------------------------------ testy */

/**
 * **Siedem kroków sekwencji trasy** i miejsce, w którym każdy jest związany — to jest lista do
 * przeglądu, nie wzorzec do grepowania (nazwy kroków żyją w prozie tytułów):
 *
 * 1. sesja        → „krok 1 (sesja): …"
 * 2. klient       → „krok 2 (klient): …"
 * 3. `formData()` → „krok 3 (formData): …"
 * 4. pole składu  → „krok 4 (pole): …"
 * 5. pula postaci → „krok 5 (pula): …"
 * 6. bramka       → opisy „ryzyko #1 — próg kompetencji" i „ryzyko #6 — limity składu"
 * 7. repo         → „krok 7 (repo): …" (trasa edycji) oraz przypadek pozytywny obu tras,
 *                    który wiąże kształt wiersza idącego do bazy
 */

beforeEach(() => {
  createClientMock.mockReset();
  // Obie trasy logują w gałęziach awaryjnych; log jest ich jedyną diagnostyką w Workerze,
  // więc go nie usuwamy — tylko wyciszamy, żeby `npm test` pozostał czytelny.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("kardynalność tabel i założenia fixtur", () => {
  it("obie trasy zapisu są w tabeli", () => {
    expect(SAVE_ROUTES).toHaveLength(2);
  });

  it("każdy z sześciu wariantów RuleViolation ma własny przypadek", () => {
    expect(VIOLATION_CASES).toHaveLength(6);
    expect(new Set(VIOLATION_CASES.map((testCase) => testCase.kind)).size).toBe(6);
  });

  it("baza naruszeń zostawia wolne miejsca w składzie, a pula ma z czego doklejać", () => {
    expect(VIOLATION_BASE.length).toBeLessThan(MAX_TEAM_SIZE);
    expect(OUTSIDERS.length).toBeGreaterThanOrEqual(MAX_TEAM_SIZE + 1 - VIOLATION_BASE.length);
    expect(CHARACTER_POOL.some((character) => character.id === UNKNOWN_CHARACTER_ID)).toBe(false);
  });

  it.each(VIOLATION_CASES.map((testCase) => [testCase.kind, testCase] as const))(
    "%s — przypadek izoluje dokładnie to jedno naruszenie, przy domkniętym progu",
    (kind, testCase) => {
      const evaluation = evaluateTeam(testCase.build(), CHARACTER_POOL);

      expect(evaluation.violations.map((violation) => violation.kind)).toEqual([kind]);
      expect(Object.values(evaluation.missing).every((gap) => gap === 0)).toBe(true);
    },
  );
});

describe.each(SAVE_ROUTES.map((route) => [route.label, route] as const))("%s — bariera zapisu", (_label, route) => {
  describe("ryzyko #1 — próg kompetencji", () => {
    it("pusty skład nie zostawia zapisu", async () => {
      const { response, writes } = await post(route, "[]");

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, BELOW_THRESHOLD_MESSAGE));
    });

    it("sześć specjalizacji bez perków nie domyka siedmiu kompetencji i nie zostawia zapisu", async () => {
      const { response, writes } = await post(route, JSON.stringify(sixSpecializationsOnly()));

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, BELOW_THRESHOLD_MESSAGE));
    });

    it("skład domykający próg zostawia dokładnie jeden zapis ze składem po parserze", async () => {
      const { response, writes } = await post(route, JSON.stringify(SOLUTION));

      expect(writes).toEqual([route.expectedWrite(SOLUTION)]);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(route.successLocation);
    });
  });

  describe("ryzyko #6 — limity składu", () => {
    it.each(VIOLATION_CASES.map((testCase) => [testCase.kind, testCase] as const))(
      "%s nie zostawia zapisu, choć żądanie omija interfejs",
      async (_kind, testCase) => {
        const { response, writes } = await post(route, JSON.stringify(testCase.build()));

        expect(writes).toEqual([]);
        expect(response.headers.get("Location")).toBe(rejectionLocation(route, BELOW_THRESHOLD_MESSAGE));
      },
    );
  });

  describe("kontrakt odmowy", () => {
    it("ładunek nie-JSON odmawia komunikatem invalid-payload, bez zapisu", async () => {
      const { response, writes } = await post(route, "{nie-json");

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, INVALID_PAYLOAD_MESSAGE));
    });

    it("odmowa to redirect 302 z pustym ciałem i bez JSON-a", async () => {
      const { response } = await post(route, "[]");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toMatch(
        new RegExp(`^${route.rejectPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
      expect(await response.text()).toBe("");
      expect(response.headers.get("Content-Type") ?? "").not.toContain("json");
    });
  });

  describe("glue sekwencji — gałęzie chroniące Worker przed 500", () => {
    it("krok 1 (sesja): brak sesji odsyła na logowanie i nie tworzy klienta", async () => {
      const { response, writes } = await run(route, { user: null });

      expect(createClientMock).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/signin");
    });

    it("krok 2 (klient): brak konfiguracji Supabase odmawia zamiast rzucać", async () => {
      const { response, writes } = await run(route, { unconfigured: true });

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(
        rejectionLocation(route, UNEXPORTED_MESSAGES.supabaseMisconfigured),
      );
    });

    it("krok 3 (formData): ciało application/json nie wychodzi z handlera jako 500", async () => {
      const { response, writes } = await run(route, { request: jsonBodyRequest() });

      expect(writes).toEqual([]);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, INVALID_PAYLOAD_MESSAGE));
    });

    it("krok 4 (pole): formularz bez pola składu odmawia tak samo jak ciało nie-JSON", async () => {
      const { response, writes } = await run(route, { request: requestWithoutCompositionField() });

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, INVALID_PAYLOAD_MESSAGE));
    });

    it("krok 5 (pula): awaria odczytu puli odmawia i nie zostawia zapisu", async () => {
      const { response, writes } = await run(route, {
        request: saveRequest(JSON.stringify(SOLUTION)),
        fake: { poolFails: true },
      });

      expect(writes).toEqual([]);
      expect(response.headers.get("Location")).toBe(rejectionLocation(route, UNEXPORTED_MESSAGES.poolUnavailable));
    });
  });
});

/* ---------------------------------------- trasa edycji: identyfikator i repo */

const EDIT_ROUTE = SAVE_ROUTES[1];

/** Dwa **poprawne** UUID-y, oba dające `null` z repo: własny wiersz, którego nie ma, i cudzy. */
const MISSING_OWN_TEAM_ID = "1c9d2f80-4a6b-4e13-9f52-0b7a6c3d8e41";
const OTHER_ACCOUNT_TEAM_ID = "7b40e6a2-13cf-4d95-8a07-25e1f9c4b6d3";

/** Sam komponent `?error=…` adresu odesłania — bez części ze ścieżką, która zawiera `id`. */
function errorQuery(location: string): string {
  return location.slice(location.indexOf("?error="));
}

describe("POST /api/teams/[id] — kodowanie identyfikatora", () => {
  it("params.id z nową linią nie trafia surowo do nagłówka Location", async () => {
    const { response } = await run(EDIT_ROUTE, { params: { id: "\n" } });
    const location = response.headers.get("Location") ?? "";

    // Sam fakt, że doszliśmy tutaj, jest asercją: surowa nowa linia w `Location` wywraca
    // `new Response`, a nieprzechwycony throw w Workerze to 500.
    expect(response.status).toBe(302);
    expect(location).not.toContain("\n");
    expect(location.startsWith("/teams/%0A?error=")).toBe(true);
  });

  it("dla poprawnego UUID kodowanie jest identycznością", async () => {
    const { response } = await run(EDIT_ROUTE, { params: { id: SAVED_TEAM.id } });

    expect(response.headers.get("Location")).toBe(
      `/teams/${SAVED_TEAM.id}?error=${encodeURIComponent(BELOW_THRESHOLD_MESSAGE)}`,
    );
  });
});

describe("POST /api/teams/[id] — krok 7 (repo): brak wiersza do aktualizacji", () => {
  it("własny nieistniejący wiersz i cudzy odcięty przez RLS odmawiają znakowo tak samo", async () => {
    const payload = saveRequest(JSON.stringify(SOLUTION));

    const missing = await run(EDIT_ROUTE, {
      request: payload,
      params: { id: MISSING_OWN_TEAM_ID },
      fake: { updatedTeam: null },
    });
    const foreign = await run(EDIT_ROUTE, {
      request: saveRequest(JSON.stringify(SOLUTION)),
      params: { id: OTHER_ACCOUNT_TEAM_ID },
      fake: { updatedTeam: null },
    });

    const expected = `?error=${encodeURIComponent(UNEXPORTED_MESSAGES.saveFailed)}`;

    expect(errorQuery(missing.response.headers.get("Location") ?? "")).toBe(expected);
    expect(errorQuery(foreign.response.headers.get("Location") ?? "")).toBe(expected);
  });

  it("nie-UUID jest odcięty przed zapytaniem: ten sam komunikat, zero zapytań o teams", async () => {
    const { response, writes, teamsQueries } = await run(EDIT_ROUTE, {
      request: saveRequest(JSON.stringify(SOLUTION)),
      params: { id: "abc" },
      fake: { updatedTeam: null },
    });

    expect(teamsQueries).toBe(0);
    expect(writes).toEqual([]);
    expect(response.status).toBe(302);
    expect(errorQuery(response.headers.get("Location") ?? "")).toBe(
      `?error=${encodeURIComponent(UNEXPORTED_MESSAGES.saveFailed)}`,
    );
  });
});
