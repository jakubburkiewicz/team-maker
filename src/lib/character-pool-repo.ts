import type { SupabaseClient } from "@supabase/supabase-js";

import { COMPETENCIES, type Competency, type PoolCharacter } from "@/lib/domain";

/**
 * Odczyt puli postaci z Supabase — jedno miejsce, w którym wiersze stają się `PoolCharacter`.
 *
 * Moduł leży w `src/lib/`, nie w `src/lib/domain/`, bo sięga po bazę. Klienta **przyjmuje jako
 * argument** i sam nie tworzy: obsługa `createClient() === null` zostaje po stronie wywołującego,
 * dokładnie jak w `src/middleware.ts`, a moduł nie wciąga `astro:env/server` — dzięki temu jego
 * czysta część (`mapPoolRows`) jest testowalna bez Astro i bez Supabase.
 *
 * Kształt wiersza jest opisany ręcznie: `supabase gen types` nie wchodzi do projektu, bo pula ma
 * jednego konsumenta (projekt jest zlinkowany od F-02, więc generowanie byłoby możliwe). Kształtu
 * strzeże schemat bazy (`not null`, enum `competency`) oraz kontrola przynależności kompetencji
 * w `mapPoolRows` — adnotacja typu przy `data` niczego nie sprawdza.
 */

/** Wiersz `public.perks` w kształcie zwracanym przez zagnieżdżony select. */
export interface PerkRow {
  id: string;
  name: string;
  competency: string;
  sort_order: number;
}

/** Wiersz `public.characters` z zagnieżdżonymi perkami. */
export interface CharacterRow {
  id: string;
  name: string;
  description: string;
  specialization: string;
  sort_order: number;
  perks: readonly PerkRow[];
}

const POOL_SELECT = "id, name, description, specialization, sort_order, perks(id, name, competency, sort_order)";

function isCompetency(value: string): value is Competency {
  return (COMPETENCIES as readonly string[]).includes(value);
}

/**
 * Sprawdza przynależność do `COMPETENCIES` zamiast rzutować. Nieznana wartość przepuszczona
 * dalej trafiłaby do `evaluateTeam`, która doliczyłaby punkty pod kluczem, którego pętla progu
 * nie odwiedza — `NaN` bez naruszenia i bez błędu.
 */
function toCompetency(value: string, rowId: string, field: string): Competency {
  if (isCompetency(value)) {
    return value;
  }
  throw new Error(`Unknown competency "${value}" in ${field} of row "${rowId}"`);
}

/** Kopia posortowana po `sort_order` — porządek nie zależy od tego, czy zapytanie go nałożyło. */
function bySortOrder<T extends { sort_order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Czyste mapowanie wiersz → `PoolCharacter`. Porządek po `sort_order` na obu poziomach nakłada
 * samo mapowanie (FR-013, FR-014) — `.order()` w `getCharacterPool` jest tylko optymalizacją,
 * a gwarancja kolejności siedzi tu, gdzie jest testowana.
 */
export function mapPoolRows(rows: readonly CharacterRow[]): readonly PoolCharacter[] {
  return bySortOrder(rows).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    specialization: toCompetency(row.specialization, row.id, "characters.specialization"),
    perks: bySortOrder(row.perks).map((perk) => ({
      id: perk.id,
      name: perk.name,
      competency: toCompetency(perk.competency, perk.id, "perks.competency"),
    })),
  }));
}

/**
 * Pula gotowa do podania do `evaluateTeam`: dwanaście postaci z perkami, uporządkowana
 * po `sort_order` na obu poziomach (FR-013, FR-014).
 *
 * Błąd zapytania jest rzucany, nie połykany — pusta pula wygląda w interfejsie identycznie jak
 * awaria bazy, a wywołujący musi umieć je rozróżnić. Pusta odpowiedź **też** jest rzucana:
 * pula jest zasiana migracją, więc zero wierszy oznacza odczyt jako `anon` (RLS zwraca pusto,
 * bez błędu), niezastosowany seed albo błędny select — nigdy legalny stan.
 */
export async function getCharacterPool(supabase: SupabaseClient): Promise<readonly PoolCharacter[]> {
  const { data, error } = await supabase
    .from("characters")
    .select(POOL_SELECT)
    .order("sort_order")
    .order("sort_order", { referencedTable: "perks" });

  if (error) {
    throw new Error(`Failed to load character pool: ${error.message}`, { cause: error });
  }

  // Bez wygenerowanych typów bazy klient nie zna kształtu wiersza — opisuje go `POOL_SELECT`
  // powyżej i interfejs `CharacterRow`; kompetencje są dodatkowo sprawdzane w `mapPoolRows`.
  const rows: readonly CharacterRow[] = data;

  if (rows.length === 0) {
    throw new Error("Character pool is empty — unauthenticated read (RLS) or seed not applied?");
  }

  return mapPoolRows(rows);
}
