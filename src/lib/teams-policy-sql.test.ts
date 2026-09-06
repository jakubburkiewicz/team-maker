import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Kontrola dwóch barier, które **istnieją wyłącznie w SQL** i których nie widzi ani lint, ani typy,
 * ani żaden inny test: `with check` w polityce `update` (US-04 — nie da się przepisać wiersza na
 * cudze konto) oraz kolumnowy `grant update (composition)` (FR-011 — nazwy-hasha nie da się
 * zmienić). Kod aplikacji wysyła wyłącznie `{ composition }`, ale to jest pierwsza bariera;
 * te dwie są drugą, niezależną — i to one obowiązują poza interfejsem.
 *
 * Test czyta pliki migracji przez `node:fs` — to nie jest stos Supabase ani runtime Astro, więc
 * mieści się w twardej regule czystości testów (wzorzec: `src/lib/domain/character-pool-sql.test.ts`).
 * Nie zapisuje niczego: migracja raz zastosowana na produkcji jest niezmienna, więc rozjazd oznacza
 * dopisanie nowej migracji, nie nadpisanie istniejącej.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

function migrationNames(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Najnowsza po nazwie migracja o danym sufiksie — tak samo porządkuje je sam Supabase. */
function latestMigration(suffix: string): string {
  const matching = migrationNames().filter((name) => name.endsWith(suffix));

  expect(matching.length, `brak migracji z sufiksem ${suffix}`).toBeGreaterThan(0);

  return readFileSync(join(MIGRATIONS_DIR, matching[matching.length - 1]), "utf8");
}

/**
 * Wszystkie migracje sklejone i **pozbawione komentarzy** — do asercji „nigdzie w katalogu nie ma X".
 * Komentarze muszą odpaść, zanim cokolwiek szukamy: te migracje opisują w prozie przywileje, których
 * nie nadają (np. „razem z `grant update` / `grant delete`" w `20260905185700_teams_schema.sql:12-14`),
 * więc szukanie DDL w surowym tekście dawałoby trafienia na zdaniach o DDL.
 */
function allMigrationsWithoutComments(): string {
  return migrationNames()
    .map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
    .join("\n")
    .replace(/--[^\n]*/g, "");
}

describe("polityka update na teams — bariery, których pilnuje wyłącznie baza", () => {
  it("polityka update ma `with check`, nie sam `using`", () => {
    // Sam `using` wybiera wiersze do zmiany, ale nie blokuje przepisania `user_id` na cudze konto.
    // Bez `with check` Guardrail US-04 dla zapisu opierałby się wyłącznie na tym, że aplikacja
    // nie wysyła tej kolumny — czyli na pierwszej barierze, nie na drugiej.
    const migration = latestMigration("_teams_update_policy.sql");

    expect(migration).toContain("using (user_id = (select auth.uid()))");
    expect(migration).toContain("with check (user_id = (select auth.uid()))");
  });

  it("przywilej update jest nadany kolumnowo, wyłącznie na composition", () => {
    const migration = latestMigration("_teams_update_policy.sql");

    expect(migration).toContain("grant update (composition) on public.teams to authenticated");
  });

  it("żadna migracja nie nadaje tabelowego update na teams", () => {
    // To jest właściwa treść tego pliku: kolumnowy grant chroni `name`, `user_id`, `id`
    // i `created_at` tylko dopóki nikt nie dopisze obok grantu tabelowego. Postgres sumuje
    // przywileje, więc jeden taki wiersz w dowolnej przyszłej migracji (np. przy S-06) rozbroiłby
    // FR-011 po cichu — bez błędu lintera, typów i bez zmiany w kodzie aplikacji.
    const grantsUpdateOnWholeTable = /grant\s+update\s+on\s+(?:table\s+)?public\.teams/i;

    expect(allMigrationsWithoutComments()).not.toMatch(grantsUpdateOnWholeTable);
  });

  it("żadna migracja nie nadaje jeszcze przywileju delete na teams (to S-06)", () => {
    // Granica zakresu S-05 zapisana jako test: usuwanie wchodzi własną migracją, nie tą.
    const grantsDelete = /grant[^;]*\bdelete\b[^;]*on\s+(?:table\s+)?public\.teams/i;

    expect(allMigrationsWithoutComments()).not.toMatch(grantsDelete);
  });
});
