import type { COMPETENCIES, PoolCharacter } from "@/lib/domain/types";

/**
 * Deterministyczne odwzorowanie stałej `CHARACTER_POOL` na tekst SQL.
 *
 * Używane dwa razy: raz przy pisaniu migracji zasiewowej i przy każdym uruchomieniu testu
 * zgodności (`character-pool-sql.test.ts`), który sprawdza, że plik migracji zawiera dosłownie
 * wynik tych funkcji. Dzięki temu dwie reprezentacje puli — stała w repo i wiersze w bazie —
 * nie mogą się cicho rozjechać, a test obywa się bez parsera SQL.
 *
 * Wynik jest w pełni deterministyczny: kolejność z tablicy wejściowej, `sort_order` z indeksu,
 * apostrof podwojony, ustalone wcięcia i separatory. Dwa wywołania na tych samych danych dają
 * znak w znak ten sam tekst.
 */

/** Literał tekstowy SQL — apostrof podwojony, bez innego cytowania. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Pełne polecenie `create type public.competency as enum (...)` w kolejności `COMPETENCIES`. */
export function renderCompetencyEnum(competencies: typeof COMPETENCIES): string {
  return `create type public.competency as enum (${competencies.map(quote).join(", ")});`;
}

/**
 * Blok upsertów dla obu tabel: najpierw `characters`, potem `perks` (klucz obcy).
 *
 * `on conflict (id) do update` obsługuje pierwszy zasiew, edycję treści i zmianę kolejności tym
 * samym tekstem, bez `delete` — po S-03 klucz obcy z `teams` do `characters(id)` nie ma
 * wtedy czego blokować. **Usunięcia** ten blok nie obsługuje: stary wiersz zostaje w bazie
 * i jego `sort_order` zderza się przy `commit` z przenumerowanym sąsiadem (odroczona
 * unikalność tylko przesuwa błąd na koniec transakcji). Nowa migracja zasiewowa usuwająca
 * postać lub perk musi zacząć od jawnego `delete … where id not in (...)` dla obu tabel,
 * PRZED tym blokiem — zgodnie z „Uwagi dotyczące migracji" w planie F-02.
 */
export function renderCharacterPoolInserts(pool: readonly PoolCharacter[]): string {
  const characterRows = pool.map(
    (character, index) =>
      `  (${[quote(character.id), quote(character.name), quote(character.description), quote(character.specialization), String(index)].join(", ")})`,
  );

  const perkRows = pool.flatMap((character) =>
    character.perks.map(
      (perk, index) =>
        `  (${[quote(perk.id), quote(character.id), quote(perk.name), quote(perk.competency), String(index)].join(", ")})`,
    ),
  );

  return [
    "insert into public.characters (id, name, description, specialization, sort_order)",
    "values",
    characterRows.join(",\n"),
    "on conflict (id) do update set",
    "  name = excluded.name,",
    "  description = excluded.description,",
    "  specialization = excluded.specialization,",
    "  sort_order = excluded.sort_order;",
    "",
    "insert into public.perks (id, character_id, name, competency, sort_order)",
    "values",
    perkRows.join(",\n"),
    "on conflict (id) do update set",
    "  character_id = excluded.character_id,",
    "  name = excluded.name,",
    "  competency = excluded.competency,",
    "  sort_order = excluded.sort_order;",
    "",
  ].join("\n");
}
