import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Kontrola barier, które **istnieją wyłącznie w SQL** i których nie widzi ani lint, ani typy, ani
 * żaden inny test. Dla podmiany składu (S-05): `with check` w polityce `update` (US-04 — nie da się
 * przepisać wiersza na cudze konto) oraz kolumnowy `grant update (composition)` (FR-011 — nazwy-hasha
 * nie da się zmienić). Dla usuwania (S-06): polityka `for delete` z `using` i tabelowy
 * `grant delete` (FR-010 — bez nich usunięcie przechodzi bez błędu i kasuje zero wierszy), a obok
 * nich strażnik tego, czego nadać **nie** wolno — `truncate` i cokolwiek dla roli `anon`.
 *
 * Dla izolacji między kontami (S-07): bariera **odczytu** i **tworzenia** plus samo włączenie RLS.
 * Odczyt dostaje tu kotwicę z konkretnego powodu — `src/lib/team-repo.ts` celowo **nie** filtruje po
 * `user_id` (patrz jego docstring, linie 11-14), więc polityka `select` nie jest drugą barierą obok
 * warunku w kodzie, tylko **jedyną**, jaka istnieje. Na niej stoją `listTeams`, `getTeamDetail`
 * i `getTeamSummary`, czyli rdzeń US-04.
 *
 * Kod aplikacji wysyła wyłącznie to, co powinien, ale to jest pierwsza bariera; te są drugą,
 * niezależną — i to one obowiązują poza interfejsem. Dla odczytu nawet ta pierwsza nie istnieje.
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

describe("polityki RLS na teams — bariery, których pilnuje wyłącznie baza", () => {
  it("RLS jest włączone na teams", () => {
    // Pojedynczy punkt, na którym stoją **wszystkie cztery** polityki naraz. Bez tej linii Postgres
    // ich nie stosuje: polityki dalej istnieją w katalogu systemowym, `\dp` dalej je pokazuje,
    // a każdy `authenticated` czyta i pisze cudze wiersze. Awaria cicha w najgorszym możliwym
    // sensie — nie rusza kodu aplikacji, nie rusza typów, nie zapala lintera.
    //
    // **Redundancja świadoma**: `src/lib/team-schema.test.ts:61` kotwiczy tę samą linię (kontrola
    // mutacyjna S-07 zaczerwieniła oba testy naraz). Zostaje tutaj, bo ten plik ma być kompletną
    // macierzą barier RLS na `teams` — insert, select, update, delete i fundament, na którym stoją.
    // Dziura w tej narracji kosztowałaby więcej niż druga asercja na jedną linię tekstu. Tamten test
    // pilnuje kształtu migracji schematu, ten — kompletności izolacji; przy rozdzieleniu plików
    // każdy zabiera swoją asercję.
    const migration = latestMigration("_teams_schema.sql");

    expect(migration).toContain("alter table public.teams enable row level security");
  });

  it("polityka insert przypina nowy wiersz do właściciela przez `with check`", () => {
    // `for insert` nie przyjmuje `using` — przy wstawianiu nie ma starego wiersza do wybrania —
    // więc cała bariera stoi w `with check`. Z aplikacji tej bariery nie da się naruszyć
    // (`createTeam` dostaje `user_id` z sesji, formularz niesie sam skład), więc ten test jest
    // jej **jedynym** dowodem: Faza 3 planu S-07 nie ma jak jej dotknąć.
    const migration = latestMigration("_teams_schema.sql");

    expect(migration).toContain('create policy "owner can insert teams" on public.teams');
    expect(migration).toContain("for insert to authenticated");
    expect(migration).toContain("with check (user_id = (select auth.uid()))");
  });

  it("polityka select wybiera wyłącznie własne wiersze", () => {
    // Jedyna bariera odczytu, jaka w ogóle istnieje: repo świadomie nie dokłada `.eq("user_id", …)`,
    // żeby drugi warunek nie maskował awarii polityki. Zdjęcie tej polityki nie wywraca niczego
    // widocznego — `select` bez polityki zwraca zero wierszy, więc właściciel przestałby widzieć
    // własne drużyny i usterka zgłosiłaby się sama. Groźna jest odwrotna mutacja: rozluźnienie
    // `using` do `true`, po którym każdy widzi wszystko, a testy zachowania dalej są zielone.
    const migration = latestMigration("_teams_schema.sql");

    expect(migration).toContain('create policy "owner can read teams" on public.teams');
    expect(migration).toContain("for select to authenticated");
    expect(migration).toContain("using (user_id = (select auth.uid()))");
  });

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

  it("polityka delete wybiera wyłącznie własne wiersze przez `using`", () => {
    // `for delete` nie przyjmuje `with check` — przy usuwaniu nie powstaje nowy wiersz do
    // sprawdzenia — więc cała bariera US-04 dla tej operacji stoi w `using`. To jedyne miejsce:
    // przywilej niżej jest z konieczności tabelowy, bo `delete` nie ma granulacji kolumnowej.
    const migration = latestMigration("_teams_delete_policy.sql");

    expect(migration).toContain("for delete to authenticated");
    expect(migration).toContain("using (user_id = (select auth.uid()))");
  });

  it("przywilej delete jest nadany na public.teams roli authenticated", () => {
    // `20260905185700_teams_schema.sql:46` cofnął ten przywilej i przekazał go S-06. Sama polityka
    // nie wystarcza: bez grantu usunięcie przechodzi bez błędu i kasuje zero wierszy — awaria
    // cicha, nie do odróżnienia od „to cudza drużyna".
    const migration = latestMigration("_teams_delete_policy.sql");

    expect(migration).toContain("grant delete on public.teams to authenticated");
  });

  it("żadna migracja nie nadaje truncate ani `all` na teams, ani niczego roli anon", () => {
    // Druga strona grantu z poprzedniego testu. `revoke` ze schematu chroni tylko dopóki nikt nie
    // dopisze grantu obok — Postgres sumuje przywileje. TRUNCATE jest tu groźniejszy niż DELETE:
    // RLS go **nie filtruje** (`20260905185700_teams_schema.sql:42-45`), więc jeden taki wiersz
    // kasowałby drużyny wszystkich kont naraz, mimo poprawnej polityki.
    //
    // Oba wzorce kotwiczą się na `grant\s`, jak `grantsUpdateOnWholeTable` wyżej: helper strzyże
    // wyłącznie komentarze, więc w korpusie zostają `revoke update, delete, truncate on
    // public.teams from authenticated;` i `revoke all on public.teams from anon;`. Bez kotwicy
    // asercje szłyby na czerwono na zdaniach, które robią dokładnie to, czego pilnują.
    const grantsTruncateOnTeams = /grant\s[^;]*\btruncate\b[^;]*on\s+(?:table\s+)?public\.teams/i;
    // `grant all` nadałby truncate (i tabelowy update) bez literalnego słowa `truncate` — dwa
    // wzorce obok by go nie zobaczyły.
    const grantsAllOnTeams = /grant\s+all\b[^;]*on\s+(?:table\s+)?public\.teams/i;
    const grantsAnythingToAnonOnTeams = /grant\s[^;]*on\s+(?:table\s+)?public\.teams\b[^;]*\banon\b/i;

    const sql = allMigrationsWithoutComments();

    expect(sql).not.toMatch(grantsTruncateOnTeams);
    expect(sql).not.toMatch(grantsAllOnTeams);
    expect(sql).not.toMatch(grantsAnythingToAnonOnTeams);
  });

  it("żadna migracja nie wyłącza RLS na teams", () => {
    // Strażnicy wyżej pilnują, żeby nikt nie **dodał** przywileju. Ten i następny pilnują drugiej,
    // groźniejszej strony: żeby nikt nie **odjął** bariery. Jedna linia w przyszłej migracji
    // rozbraja wszystkie cztery polityki naraz i nie zostawia śladu nigdzie poza `supabase/`.
    const disablesRlsOnTeams = /alter\s+table\b[^;]*\bpublic\.teams\b[^;]*disable\s+row\s+level\s+security/i;

    expect(allMigrationsWithoutComments()).not.toMatch(disablesRlsOnTeams);
  });

  it("żadna migracja nie kasuje polityki na teams", () => {
    // Furtka, żeby ten strażnik nie zapalał się na uzasadnionej pracy: **korekta** istniejącej
    // polityki idzie przez `alter policy`, którego ten wzorzec nie widzi. Migracja raz zastosowana
    // na produkcji jest niezmienna, więc poprawka i tak musi być nową migracją — `alter policy`
    // jest jej właściwym kształtem.
    //
    // `drop policy` zostaje zarezerwowane na **świadome zdjęcie bariery**. Taka zmiana wymaga
    // zdjęcia tego strażnika w tym samym commicie, z uzasadnieniem tutaj. Czerwony test jest wtedy
    // pytaniem „czy na pewno", nie przeszkodą do obejścia — nie osłabiaj wzorca, żeby przeszedł.
    const dropsPolicyOnTeams = /drop\s+policy\b[^;]*\bon\s+(?:table\s+)?public\.teams\b/i;

    expect(allMigrationsWithoutComments()).not.toMatch(dropsPolicyOnTeams);
  });
});
