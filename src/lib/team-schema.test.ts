import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Wartownik migracji `teams` — tripwire w CI na „tabela bez odcięcia jest dziurą od pierwszej
 * minuty jej istnienia" (roadmapa, S-03). Migracja nie może stracić RLS ani zyskać polityki dla
 * `anon` bez czerwonego testu.
 *
 * Asercje są na tekście pliku, bez parsera SQL — jak w `character-pool-sql.test.ts`. Test czyta
 * migrację przez `node:fs`, więc mieści się w twardej regule czystości testów (bez Astro, bez
 * Supabase). Komentarze `--` są zdejmowane przed asercjami, żeby prozę w nagłówku migracji dało się
 * swobodnie redagować, a asercje wiązały wyłącznie polecenia.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

/** Najnowsza po nazwie migracja o danym sufiksie — tak samo porządkuje je sam Supabase. */
function latestMigration(suffix: string): string {
  const matching = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(suffix))
    .sort();

  expect(matching.length, `brak migracji z sufiksem ${suffix}`).toBeGreaterThan(0);

  return readFileSync(join(MIGRATIONS_DIR, matching[matching.length - 1]), "utf8");
}

/** Polecenia bez komentarzy `--`, z pobielonymi odstępami — jedno polecenie w jednej linii. */
function statementsOf(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement.length > 0);
}

const migration = latestMigration("_teams_schema.sql");
const statements = statementsOf(migration);
const policies = statements.filter((statement) => statement.startsWith("create policy"));

describe("migracja teams — odcięcie na właściciela", () => {
  it("włącza RLS na public.teams", () => {
    expect(statements).toContain("alter table public.teams enable row level security");
  });

  it("każda polityka na public.teams jest dla authenticated i wiąże wiersz z auth.uid()", () => {
    expect(policies.length).toBeGreaterThan(0);

    for (const policy of policies) {
      expect(policy).toContain("on public.teams");
      expect(policy).toContain("to authenticated");
      expect(policy).toContain("auth.uid()");
    }
  });

  it("nie ma żadnej polityki ani przywileju dla anon", () => {
    for (const statement of statements) {
      expect(statement).not.toContain("to anon");
    }
    expect(statements).toContain("revoke all on public.teams from anon");
  });

  it("cofa authenticated przywileje, których polityki nie pokrywają", () => {
    expect(statements).toContain("revoke update, delete, truncate on public.teams from authenticated");
  });
});

describe("migracja teams — nazwa-hash i skład", () => {
  it("nazwa jest generowana w bazie (default kolumny) i unikalna w obrębie konta", () => {
    const createTable = statements.find((statement) => statement.startsWith("create table public.teams"));

    expect(createTable).toBeDefined();
    expect(createTable).toMatch(/name text not null default /);
    expect(createTable).toContain("unique (user_id, name)");
  });

  it("skład jest tablicą jsonb — obiekt odrzuca check", () => {
    const createTable = statements.find((statement) => statement.startsWith("create table public.teams"));

    expect(createTable).toContain("composition jsonb not null check (jsonb_typeof(composition) = 'array')");
  });
});
