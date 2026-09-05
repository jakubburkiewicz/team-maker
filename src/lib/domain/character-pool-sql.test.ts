import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CHARACTER_POOL, COMPETENCIES, type PoolCharacter } from "@/lib/domain";
import { renderCharacterPoolInserts, renderCompetencyEnum } from "@/lib/domain/character-pool-sql";

/**
 * Kontrola zgodności autorskiego źródła prawdy z tym, co realnie wjeżdża do bazy.
 *
 * Test czyta pliki migracji przez `node:fs` — to nie jest stos Supabase ani runtime Astro, więc
 * mieści się w twardej regule czystości testów. Test NIE zapisuje pliku migracji: migracja raz
 * zastosowana na produkcji jest niezmienna, więc rozjazd oznacza dopisanie nowej migracji,
 * nie nadpisanie istniejącej.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));

/** Najnowsza po nazwie migracja o danym sufiksie — tak samo porządkuje je sam Supabase. */
function latestMigration(suffix: string): string {
  const matching = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(suffix))
    .sort();

  expect(matching.length, `brak migracji z sufiksem ${suffix}`).toBeGreaterThan(0);

  return readFileSync(join(MIGRATIONS_DIR, matching[matching.length - 1]), "utf8");
}

describe("renderer SQL — determinizm i cytowanie", () => {
  it("dwa wywołania na tych samych danych dają znak w znak ten sam tekst", () => {
    expect(renderCharacterPoolInserts(CHARACTER_POOL)).toBe(renderCharacterPoolInserts(CHARACTER_POOL));
    expect(renderCompetencyEnum(COMPETENCIES)).toBe(renderCompetencyEnum(COMPETENCIES));
  });

  it("apostrof w treści jest podwajany, a sort_order bierze się z pozycji w tablicy", () => {
    const pool: readonly PoolCharacter[] = [
      {
        id: "first",
        name: "O'Neil",
        description: "Won't quit.",
        specialization: "combat",
        perks: [{ id: "first-perk", name: "Rock 'n' roll", competency: "hacking" }],
      },
      {
        id: "second",
        name: "Second",
        description: "Second one.",
        specialization: "medicine",
        perks: [],
      },
    ];

    const sql = renderCharacterPoolInserts(pool);

    expect(sql).toContain("('first', 'O''Neil', 'Won''t quit.', 'combat', 0)");
    expect(sql).toContain("('second', 'Second', 'Second one.', 'medicine', 1)");
    expect(sql).toContain("('first-perk', 'first', 'Rock ''n'' roll', 'hacking', 0)");
  });

  it("enum wymienia siedem kompetencji w kolejności COMPETENCIES", () => {
    expect(renderCompetencyEnum(COMPETENCIES)).toBe(
      "create type public.competency as enum ('combat', 'hacking', 'stealth', 'engineering', 'medicine', 'negotiation', 'navigation');",
    );
  });
});

describe("zgodność puli z migracjami", () => {
  it("migracja zasiewowa zawiera dosłownie wyrenderowany blok upsert z CHARACTER_POOL", () => {
    const migration = latestMigration("_character_pool_seed.sql");

    expect(migration).toContain(renderCharacterPoolInserts(CHARACTER_POOL));
  });

  it("migracja schematu zawiera dosłownie wyrenderowany enum z COMPETENCIES", () => {
    // Sama liczba wartości nie wystarczy — siedem wartości o innych nazwach przeszłoby, a rozjazd
    // ujawniłby się dopiero jako ciche NaN w sumach evaluateTeam.
    const migration = latestMigration("_character_pool_schema.sql");

    expect(migration).toContain(renderCompetencyEnum(COMPETENCIES));
  });
});
