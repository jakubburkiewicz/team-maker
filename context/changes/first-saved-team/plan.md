# Plan implementacji: Zapis domkniętej drużyny z potwierdzeniem (S-03)

## Przegląd

Gwiazda przewodnia roadmapy. Przycisk „Embark on the job" — dziś sama bramka bez handlera —
zapisuje skład domykający próg do nowej tabeli `teams` pod automatycznie wygenerowaną nazwą-hashem
i prowadzi na stronę, która **najpierw wprost potwierdza zapis**, a dopiero potem mówi „Work in
Progress" (FR-007, FR-011, FR-018, FR-019, US-01). Serwer powtarza `evaluateTeam` na puli z bazy,
więc Guardrail „zapisana drużyna zawsze spełnia próg — reguła obowiązuje także poza interfejsem"
dostaje dowód w `npm test`, a nie deklarację. Tabela od pierwszej migracji ma RLS na właściciela,
bo „tabela bez tego odcięcia jest dziurą od pierwszej minuty jej istnienia" (roadmapa, S-03).

Bez listy drużyn i widoku szczegółów (S-04), bez edycji (S-05), bez usuwania (S-06), bez dowodu
izolacji na wszystkich czterech operacjach (S-07), bez licznika brakujących punktów (S-08).

## Analiza stanu obecnego

**Domena jest gotowa — brakuje pisarza do bazy:**

- `src/lib/domain/evaluate-team.ts:54` — `evaluateTeam(composition, pool)` zwraca `isValid` (brak
  naruszeń ORAZ próg); komentarz w `:50-52` wprost przewiduje „bramkę zapisu (S-03/S-05)" jako
  konsumenta tego samego źródła co wykres. `isValid` jest odporne na skład doklejony na siłę —
  każde naruszenie limitu je zeruje — więc serwer może wiązać zapis z nim wprost.
- `src/lib/domain/roster.ts` — jedyni pisarze składu; `roster.test.ts` dowodzi, że skład zbudowany
  wyłącznie przez nich nie ma naruszeń, a `findThresholdSolution(CHARACTER_POOL)` odtworzony przez
  pisarzy daje `isValid: true`. Ten sam solver posłuży testom bramki serwerowej (bez literałów id —
  uwaga F3 z przeglądu S-01).
- `src/lib/character-pool-repo.ts:88` — `getCharacterPool(supabase)` przyjmuje klienta jako argument,
  rzuca przy błędzie i pustej puli. Wzorzec dla `team-repo.ts`: klient jako argument, `throw`,
  brak importu `@/lib/supabase`, czysta część testowana bez Supabase (`mapPoolRows`).

**Interfejs S-02:**

- `src/components/team/EmbarkGate.tsx` — `Button type="button"` bez `onClick`, `aria-describedby`
  na statyczny tekst; propsy `{ ready }`. Plan S-02 celowo nie przesądził „formularz vs `fetch`".
- `src/components/team/TeamComposer.tsx:36` — jedyny właściciel `composition: TeamComposition`,
  wyłącznie w pamięci (rozstrzygnięcie S-01). Nie przeżywa przeładowania strony.
- `src/pages/teams/new.astro` — łapie wyjątek z repo i renderuje stan błędu; **nie czyta**
  `Astro.url.searchParams.get("error")` — po dodaniu redirectu `?error=` ma go pokazać.
- `src/components/auth/SignInForm.tsx:43` — natywny `<form method="POST" action="/api/auth/signin">`;
  `SubmitButton.tsx:12` bierze `pending` z `useFormStatus()`, co działa wyłącznie wewnątrz
  natywnego formularza. `fetch` nie występuje nigdzie w `src/`.
- `src/pages/auth/confirm-email.astro` — szablon strony potwierdzenia: karta `max-w-sm`, emoji,
  nagłówek gradientowy, opis, link wyjścia `text-purple-300 hover:underline`.
- `src/components/auth/ServerError.tsx` — komponent React bez stanu renderujący `?error=`;
  zwraca `null` przy pustym. Nadaje się do użycia statycznie z `.astro` (bez `client:*`).

**Trasy i ochrona:**

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/teams"]`, dopasowanie `startsWith`.
  Prefiks `/teams` **nie** obejmuje `/api/teams` — punkt kontrolny z przeglądu S-01. Nowe strony
  pod `/teams/...` są chronione automatycznie; trasa API musi zostać dopisana.
- `src/pages/api/auth/signin.ts` — kształt trasy: `formData()`, `createClient()` z null-checkiem,
  każdy błąd → `context.redirect(".../?error=" + encodeURIComponent(msg))`, sukces → redirect.
- `context/deployment/deploy-plan.md:188` — `security.checkOrigin` jest aktywne: `POST` bez
  nagłówka `Origin` dostaje 403. Formularz z tej samej strony wysyła `Origin` sam; `curl` musi go
  podać jawnie.

**Baza:**

- `supabase/migrations/20260905081500_character_pool_schema.sql` — wzorzec: tabela, `enable row
  level security`, **wyłącznie** polityki, których fragment potrzebuje; `20260905090700_…revoke_writes`
  — obrona w głąb na poziomie `GRANT`, bo Supabase nadaje `anon`/`authenticated` wszystkie
  przywileje na nowych tabelach w `public`.
- Identyfikatory postaci i perków są `text` (`vesper`, `vesper-breach-protocols`) — skład w `jsonb`
  przenosi je dosłownie, w kształcie `MemberSelection` (`{ characterId, perkIds }`).
- Projekt hostowany **jest zlinkowany** (`deploy-plan.md:141-148`); migracja `revoke_writes`
  **czeka na `db push`** (`:150-155`) — push S-03 zabierze ją ze sobą i ma zaktualizować ten akapit.
- `infrastructure.md:171-176` — rejestr ryzyk: migracje RLS nie cofają się same; „migracje
  wyłącznie addytywne, przed zmianą schematu zanotuj wersję workera zgodną ze schematem". S-03
  jest pierwszą zmianą schematu po wdrożeniu — `deploy-plan.md:169` zwalniał to ryzyko tylko dlatego,
  że „nie zmieniano schematu ani polityk RLS".
- Zero bibliotek do identyfikatorów/hashy w zależnościach. `gen_random_uuid()` jest w rdzeniu
  Postgresa (≥ 13) — nazwa-hash nie potrzebuje `pgcrypto`.

**Testy i lint:** `vitest run` nad `src/**/*.test.ts`, środowisko `node`, bez jsdom; testy nie mogą
importować `astro:*` ani `@/lib/supabase`; testy mogą czytać pliki przez `node:fs`
(`character-pool-sql.test.ts`). `strictTypeChecked`, `react-compiler` jako `error`, bez `zod`.

## Pożądany stan końcowy

Zalogowany gracz na `/teams/new` domyka próg (przepis z S-02), klika „Embark on the job" i po
chwili widzi stronę `/teams/<uuid>/embark`: „Team A3F9C0D1 is saved" z nazwą odczytaną z bazy,
pod spodem „Work in Progress" z wyjaśnieniem, że misje nie są częścią tej wersji, oraz linki
„Assemble another team" i „Back to dashboard". W tabeli `teams` jest jeden wiersz z jego
`user_id`, ośmioznakową nazwą i składem w `jsonb` dokładnie takim, jaki ułożył (kolejność członków
i perków zachowana). Drugie konto nie widzi tego wiersza ani przez PostgREST, ani przez
`/teams/<uuid>/embark` (404). Skład poniżej progu lub łamiący limity, wysłany bezpośrednio na
`POST /api/teams` z ominięciem interfejsu, wraca na `/teams/new?error=…` i niczego nie zapisuje.

Weryfikacja: `npm test` dowodzi, że bramka serwerowa przepuszcza wyłącznie składy z `isValid`
i odrzuca każdy inny kształt wejścia; `npm run lint` i `npm run build` przechodzą; ścieżka ręczna
w `npm run dev` na dwóch kontach; po Fazie 4 ta sama ścieżka na produkcji.

### Kluczowe odkrycia:

- `insert().select().single()` przez PostgREST przy włączonym RLS: `returning` filtruje wiersze
  polityką **`select`**. Migracja bez polityki `select` dla właściciela sprawia, że wiersz się
  zapisuje, a klient dostaje błąd „0 rows" — gracz widzi błąd mimo udanego zapisu. Obie polityki
  muszą wjechać w tej samej migracji.
- `Astro.params.id` niebędące UUID daje błąd Postgresa `22P02` przy porównaniu z kolumną `uuid` —
  repo musi zwrócić „nie znaleziono" zamiast rzucać, inaczej `/teams/abc/embark` renderuje stan
  awarii zamiast 404.
- `useFormStatus()` czyta status najbliższego formularza-przodka, więc komponent z `pending` musi
  być **dzieckiem** `<form>`, nie samym elementem z `<form>` w środku (wzorzec `SubmitButton`).
- Ukryte pole `value={JSON.stringify(composition)}` jest kontrolowane przez React i odświeża się
  z każdym renderem wyspy — formularz zawsze wysyła bieżący skład bez osobnej synchronizacji.
- Przepis na skład domykający próg (do weryfikacji ręcznej, z planu S-02): Vesper Kane, Dolores
  „Torque" Amani, Sable Nine, Cassius Wren, Dr. Imani Oyelaran, Ren „Ghostline" Takahashi + perki
  „Extraction Routes" (Vesper) i „Service Tunnel Access" (Torque).

## Czego NIE robimy

- **Lista drużyn, widok szczegółów, stan pusty** (FR-005, FR-008) — S-04. Strona `/teams/[id]/embark`
  czyta wyłącznie `id` i `name`; nie renderuje składu ani wykresu.
- **Edycja i usuwanie** (FR-009, FR-010) — S-05, S-06. Migracja nie zawiera polityk `update`
  ani `delete` — każdy fragment dokłada wyłącznie polityki, których potrzebuje (wzorzec F-02).
- **Dowód izolacji na czterech operacjach** — S-07. S-03 weryfikuje izolację ręcznie na odczycie
  (`embark`, PostgREST); 404 dla nieznanego id jest **prowizoryczne** i wpis S-07 w roadmapie ma
  to odnotować.
- **Próg w bazie** (trigger, RPC `security definer`, `revoke insert` na `teams`) — odrzucone
  w sesji planowania: druga implementacja reguły w SQL bez testu w CI. Ryzyko bezpośredniego zapisu
  przez PostgREST przyjęte świadomie, bo `SUPABASE_KEY` jest sekretem serwera i nie trafia do
  przeglądarki.
- **`fetch` i JSON z trasy API** — transport to natywny formularz; trasa zachowuje kształt `?error=`.
- **Trwałość składu przy błędzie zapisu** — przeładowanie po `?error=` zeruje skład (S-01); przyjęte.
- **Normalizacja składu do tabel** (`team_members`, klucz obcy do `characters`) — jsonb; brak FK
  przyjęty świadomie (pula zamknięta, zasiew upsertem bez `delete`).
- **Deterministyczna nazwa z treści, edycja nazwy, ponowienie przy kolizji** — nazwa losowa
  z `default` w bazie; kolizja w koncie (1 na 4 mld) kończy się błędem ogólnym.
- **`supabase gen types`, `zod`, nowe zależności npm, nowe prymitywy shadcn** — nie.
- **Automatyczne wdrożenie workera** — deploy nadal ręczny (`npx wrangler deploy`), poza planem.
- **Strona 404 z nawigacją** — goła odpowiedź 404; ładniejsza wersja wchodzi z S-07, gdy istnieje lista.
- **Testy komponentów React / trasy API** — brak jsdom i Astro w testach (twarda reguła);
  warstwa spięcia weryfikowana ręcznie i `curl`.

## Podejście do implementacji

Cztery warstwy w kolejności od bazy do ekranu, jak w F-02 — bo migracja raz zastosowana na produkcji
jest niezmienna, a gwiazda przewodnia jest „dowieziona" dopiero na produkcji:

1. **Schemat** — jedna tabela `teams` z całym składem w `jsonb`. Jeden wiersz = jedna drużyna, więc
   zapis (S-03) i późniejsza podmiana składu (S-05) są atomowe z konstrukcji, bez RPC. RLS: `insert`
   z `with check`, `select` z `using`, oba na `user_id = auth.uid()`; `revoke all` dla `anon`.
   Nazwa-hash jako `default` kolumny — powstaje przy każdym pisarzu, także przyszłym.
2. **Bramka serwerowa** — jeden czysty moduł `src/lib/team-submission.ts` łączy parser kształtu
   wejścia z `evaluateTeam`; trasa API woła go i tylko przy `ok` pisze do bazy. Cała logika decyzji
   jest testowalna bez Astro i Supabase; trasa jest cienkim klejem w kształcie `signin.ts`.
3. **Ekran** — `EmbarkGate` staje się formularzem z ukrytym polem JSON (konwencja repo,
   `useFormStatus` za darmo); potwierdzenie na osobnej stronie, która **czyta nazwę z bazy** —
   dowód trwałości, nie echo query stringa.
4. **Produkcja** — `supabase db push` z notatką o wersji workera zgodnej ze schematem, potem
   `npx wrangler deploy`; kolejność jest wiążąca (worker z trasą `/api/teams` bez tabeli = 500).

## Krytyczne szczegóły implementacji

- **Czas i cykl życia (migracja → worker):** w Fazie 4 najpierw `supabase db push`, potem
  `npx wrangler deploy`. Odwrotna kolejność wystawia trasę zapisu bez tabeli. Wycofanie jest
  **różne dla dwóch migracji w tym pushu** (patrz Uwagi dotyczące migracji): `teams` jest czysto
  addytywna, więc wycofaniem jest wycofanie workera (`wrangler rollback`) — tabela zostaje, co jest
  nieszkodliwe; `revoke_writes` z F-02 addytywna **nie jest** i `wrangler rollback` jej nie odwraca.
  Wersję workera **sprzed** wdrożenia zapisz w `deploy-plan.md` przed pushem.
- **Sekwencjonowanie polityk:** polityki `insert` i `select` w jednej migracji (patrz Kluczowe
  odkrycia — `returning` bez `select` daje udany zapis z błędem u klienta).
- **Specyfikacja UX formularza:** przycisk `type="submit"`, `disabled={!ready || pending}` — i to
  jedyna bariera. Bez `onSubmit`: zablokowany przycisk nie wysyła formularza, a implicit submission
  (Enter) wymaga pola tekstowego — ukryte pole go nie wyzwala, więc gałąź `preventDefault()` przy
  `!ready` nie miałaby jak się wykonać. Tekst pod przyciskiem bez zmian z S-02. Po wysłaniu
  przeglądarka nawiguje, więc wyspa nie musi nic resetować.
- **Debugowanie:** `curl` na `/api/teams` bez `-H "Origin: <adres dev>"` dostaje 403 z
  `checkOrigin`, nie z naszej trasy — nie szukaj błędu w handlerze.

---

## Faza 1: Schemat `teams` w bazie

### Przegląd

Powstaje pierwsza tabela z danymi użytkownika, od pierwszej migracji odcięta na właściciela.
Faza kończy się weryfikacją RLS na dwóch kontach na stosie lokalnym — zanim istnieje jakikolwiek
kod, który do tej tabeli pisze.

### Wymagane zmiany:

#### 1. Migracja schematu

**Plik**: `supabase/migrations/<timestamp>_teams_schema.sql` (nowy; timestamp późniejszy niż
`20260905090700`)

**Cel**: Tabela drużyn z nazwą-hashem generowaną w bazie i RLS na właściciela — FR-007, FR-011,
Guardrail izolacji danych między kontami.

**Umowa**: komentarz nagłówkowy w stylu migracji F-02 (po polsku: po co tabela, dlaczego jsonb,
dlaczego tylko `insert`/`select`, kto dokłada resztę). Treść:

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nazwa-hash (FR-011): 8 znaków hex, losowa, nieedytowalna; S-05 nie umieszcza jej w update.
  name text not null default upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
  -- Skład w kształcie TeamComposition z src/lib/domain/types.ts: [{ characterId, perkIds }].
  composition jsonb not null check (jsonb_typeof(composition) = 'array'),
  created_at timestamptz not null default now(),
  constraint teams_user_id_name_key unique (user_id, name)
);

create index teams_user_id_idx on public.teams (user_id);

alter table public.teams enable row level security;

create policy "owner can insert teams" on public.teams
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "owner can read teams" on public.teams
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.teams from anon;
-- Obrona w głąb na poziomie GRANT, wzorzec `20260905090700_character_pool_revoke_writes.sql`:
-- Supabase nadaje `authenticated` wszystkie przywileje na nowych tabelach w `public`. RLS domyka
-- UPDATE/DELETE (brak polityk = zero wierszy), ale **nie dotyczy TRUNCATE** — ten filtruje wyłącznie
-- przywilej. `insert`/`select` zostają, bo wymagają ich polityki powyżej.
revoke update, delete, truncate on public.teams from authenticated;
```

Bez polityk `update`/`delete` (S-05, S-06). **Konsekwencja dla S-05/S-06:** sama polityka nie
wystarczy — ich migracje muszą dołożyć `grant update` / `grant delete on public.teams to
authenticated` obok polityki, inaczej operacja da ciche zero wierszy. Bez klucza obcego do `characters` (decyzja: jsonb).
`(select auth.uid())` zamiast gołego `auth.uid()` — zalecenie Supabase (funkcja liczona raz na
zapytanie, nie na wiersz).

#### 2. Wartownik migracji

**Plik**: `src/lib/team-schema.test.ts` (nowy)

**Cel**: Tripwire w CI na „tabela bez odcięcia jest dziurą": migracja `teams` nie może stracić RLS
ani zyskać polityki dla `anon` bez czerwonego testu. Wzorzec czytania migracji przez `node:fs`
z `character-pool-sql.test.ts` (lokalizacja po sufiksie `_teams_schema.sql`, najnowsza po nazwie).

**Uwaga o ścieżce**: wzorzec liczy katalog migracji od `import.meta.url`, więc literał zależy od
położenia pliku testu. `character-pool-sql.test.ts:19` leży w `src/lib/domain/` i używa
`../../../supabase/migrations/`; ten wartownik leży w `src/lib/`, więc literał brzmi
`fileURLToPath(new URL("../../supabase/migrations/", import.meta.url))`. Helper `latestMigration`
(`character-pool-sql.test.ts:22-30`) jest **lokalny i nieeksportowany** — zduplikuj go w nowym pliku
(~8 linii); nie wydzielaj wspólnego modułu dla dwóch konsumentów.

**Umowa**: asercje na tekście pliku (bez parsera SQL, jak w F-02): zawiera
`alter table public.teams enable row level security`; każde `create policy` na `public.teams`
zawiera `to authenticated` i `auth.uid()`; nie zawiera `to anon`; zawiera
`revoke all on public.teams from anon`; zawiera `revoke update, delete, truncate on public.teams
from authenticated`; kolumna `name` ma `default`; jest `unique (user_id, name)`.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi, w tym nowy `src/lib/team-schema.test.ts`
- `npx astro sync && npm run lint` przechodzi
- Żaden test nie sięga po Supabase: `grep -rl "lib/supabase" --include='*.test.ts' src` pusty

#### Ręczna weryfikacja:

- `supabase start && supabase db reset` stosuje wszystkie cztery migracje bez błędu; w Studio
  tabela `teams` ma RLS włączone i dokładnie dwie polityki (`insert`, `select`) dla `authenticated`
- Dwa konta testowe na stosie lokalnym (Studio → Authentication, potwierdzanie wyłączone lokalnie):
  `insert` do `teams` z tokenem konta A (`user_id` = A, `composition` = `'[]'`) przechodzi i zwraca
  wiersz z ośmioznakową nazwą; ten sam `insert` z `user_id` = B odrzucony przez `with check`;
  `select` z tokenem B zwraca zero wierszy, z kluczem `anon` — błąd uprawnień lub zero wierszy
- `insert` z `composition = '{}'` (obiekt, nie tablica) odrzucony przez `check`
- Wiersz testowy usunięty (`supabase db reset` albo `delete` jako `postgres`)

**Uwaga implementacyjna**: po przejściu weryfikacji automatycznej zatrzymaj się na potwierdzenie
użytkownika (kontrola RLS na dwóch kontach) przed Fazą 2.

---

## Faza 2: Bramka zapisu poza interfejsem

### Przegląd

Czysty moduł decyzji, repo drużyn i trasa `POST /api/teams`. Po tej fazie Guardrail „reguła
obowiązuje także poza interfejsem" ma dowód w `npm test`, a `curl` potrafi zapisać drużynę bez
przeglądarki — i nie potrafi zapisać drużyny poniżej progu.

### Wymagane zmiany:

#### 1. Moduł decyzji zapisu

**Plik**: `src/lib/team-submission.ts` (nowy)

**Cel**: Jedno miejsce, w którym surowe wejście z formularza staje się `TeamComposition` albo
odrzuceniem, i w którym próg jest sprawdzany tym samym `evaluateTeam` co w wyspie. Czysty: bez
`astro:*`, bez `@/lib/supabase`; leży w `src/lib/` (granica I/O), nie w `src/lib/domain/`
(reguła). Wyspa importuje stąd nazwę pola, więc obie strony formularza dzielą jeden literał.

**Umowa**:

```ts
/** Nazwa ukrytego pola formularza — wspólna dla `EmbarkGate` i `POST /api/teams`. */
export const COMPOSITION_FIELD = "composition";

/** JSON → TeamComposition; `null` przy każdym odstępstwie od kształtu (nie rzuca). */
export function parseTeamComposition(raw: string): TeamComposition | null;

export type SubmissionRejection = { kind: "invalid-payload" } | { kind: "below-threshold" };
export type SubmissionResult =
  | { ok: true; composition: TeamComposition }
  | { ok: false; reason: SubmissionRejection };

/** Parser + `evaluateTeam(...).isValid`. `below-threshold` obejmuje też naruszenia limitów. */
export function gateTeamSubmission(raw: string, pool: CharacterPool): SubmissionResult;
```

Parser przyjmuje wyłącznie: tablicę obiektów, każdy z `characterId: string` i
`perkIds: string[]`; nic więcej nie jest wymagane, nadmiarowe pola są **odrzucane** (nie trafiają
do bazy). Nie-JSON, nie-tablica, element nie-obiekt, brak/zły typ pola → `null`. Parser **nie**
sprawdza limitów ani puli — to robi `evaluateTeam`; rozdział jest celowy, żeby test parsera nie
duplikował testów reguły. Wynik `ok` niesie skład **po parserze** (bez nadmiarowych pól) — to on
idzie do bazy.

#### 2. Testy modułu decyzji

**Plik**: `src/lib/team-submission.test.ts` (nowy)

**Cel**: Dowód Guardraila poza interfejsem. Progi i limity w asercjach literałami z PRD; skład
z `findThresholdSolution(CHARACTER_POOL)` (import z `@/lib/domain/solvability`, jak
w `roster.test.ts`), identyfikatory z `CHARACTER_POOL`, nie literały.

**Umowa**: przypadki:

- `parseTeamComposition`: round-trip `JSON.stringify` składu zbudowanego przez `addMember` +
  `togglePerk` daje równy skład (`toEqual`); pusta tablica → `[]`; nie-JSON, `"{}"`, `"[1]"`,
  element bez `perkIds`, `perkIds` z liczbą, `characterId` liczbowe → `null`; nadmiarowe pole
  (`{ characterId, perkIds, name: "x" }`) znika z wyniku;
- `gateTeamSubmission`: skład z `findThresholdSolution(CHARACTER_POOL)` zserializowany → `ok`
  z `isValid` potwierdzonym niezależnie przez `evaluateTeam` (solver nie jest jedynym świadkiem);
  sześć postaci bez perków → `below-threshold` (zapis PRD: perki są konieczne); ten sam skład
  z siódmym członkiem doklejonym na siłę → `below-threshold` (naruszenie limitu zeruje `isValid`);
  ten sam skład z trzecim perkiem doklejonym → `below-threshold`; `characterId` spoza puli →
  `below-threshold`; `"not json"` → `invalid-payload`; pusta tablica → `below-threshold`.

#### 3. Repozytorium drużyn

**Plik**: `src/lib/team-repo.ts` (nowy)

**Cel**: Zapis i odczyt nagłówka drużyny w jednym miejscu; wzorzec `character-pool-repo.ts`
(klient jako argument, `throw` przy błędzie, brak `@/lib/supabase`).

**Umowa**:

```ts
export interface TeamSummary { id: string; name: string }

/** Wstawia wiersz i zwraca id + nazwę wygenerowaną przez bazę. Rzuca przy błędzie zapytania. */
export async function createTeam(
  supabase: SupabaseClient,
  input: { userId: string; composition: TeamComposition },
): Promise<TeamSummary>;

/** `null`, gdy wiersza nie ma lub RLS go ukrywa, a także gdy `id` nie jest UUID. Rzuca przy błędzie. */
export async function getTeamSummary(
  supabase: SupabaseClient,
  id: string | undefined,
): Promise<TeamSummary | null>;

/** Czysta kontrola formatu UUID — eksportowana do testu; zawęża typ dla wywołującego. */
export function isTeamId(value: string | undefined): value is string;
```

`createTeam`: `.insert({ user_id, composition }).select("id, name").single()` — `name` z `default`,
nie podawana. `getTeamSummary`: `isTeamId` przed zapytaniem (bez tego Postgres rzuca `22P02`),
potem `.select("id, name").eq("id", id).maybeSingle()`. Kształt wiersza opisany ręcznie
(`TeamSummaryRow`), jak `CharacterRow`. `isTeamId` ma krótki test w `src/lib/team-repo.test.ts`
(UUID v4 → true; `abc`, pusty, UUID bez myślników, `undefined` → false); nic więcej w repo nie jest
czyste.

**Dlaczego `string | undefined`**: `Astro.params` ma typ `Record<string, string | undefined>`, więc
`getTeamSummary(supabase, Astro.params.id)` z parametrem `string` jest błędem ts(2345). Żadne
kryterium automatyczne tego nie złapie — `npm run build` i `npm run lint` nie typechecują, a CI nie
uruchamia `astro check` — a naprawa rzutowaniem `as string` przywróciłaby idiom, od którego trasa API
świadomie odchodzi. Strażnik formatu jest więc jednym miejscem odcięcia obu złych wejść (`undefined`
i nie-UUID), a `embark.astro` woła repo bez zawężania i bez rzutowania.

#### 4. Trasa zapisu

**Plik**: `src/pages/api/teams/index.ts` (nowy)

**Cel**: FR-007 — jedyny pisarz do `teams` w aplikacji; kształt `signin.ts`.

**Umowa**: `export const POST: APIRoute`. Kolejność:

1. `context.locals.user` brak → `redirect("/auth/signin")` (obrona w głąb; middleware już
   przekierował).
2. `createClient()` null → `/teams/new?error=Supabase is not configured`.
3. `formData().get(COMPOSITION_FIELD)` — nie-string → `?error=Invalid team payload`.
4. `getCharacterPool(supabase)` w `try` → błąd → `?error=Character pool is unavailable`
   (log `console.error` z `eslint-disable-next-line no-console`, jak `new.astro`).
5. `gateTeamSubmission(raw, pool)` → `invalid-payload` → `?error=Invalid team payload`;
   `below-threshold` → `?error=Every competency needs at least 2 points before the team can embark.`
   (literał z `COMPETENCY_THRESHOLD`, ten sam tekst co bramka).
6. `createTeam(supabase, { userId: user.id, composition })` w `try` → błąd →
   `?error=Could not save the team`; sukces → `redirect(\`/teams/${id}/embark\`)`.

Wszystkie `?error=` celują w `/teams/new`. Żaden `throw` nie wychodzi z handlera. Bez JSON
w odpowiedziach.

#### 5. Ochrona trasy

**Plik**: `src/middleware.ts`

**Cel**: Domknięcie punktu kontrolnego z przeglądu S-01.

**Umowa**: `PROTECTED_ROUTES = ["/dashboard", "/teams", "/api/teams"]`. Bez innych zmian.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi, w tym `src/lib/team-submission.test.ts` i `src/lib/team-repo.test.ts`
- `npx astro sync && npm run lint` przechodzi
- `npm run build` przechodzi
- `grep -rl "lib/supabase" --include='*.test.ts' src` pusty; `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/team-submission.ts src/lib/team-repo.ts` pusty
- `package.json` / `package-lock.json` bez zmian: `git diff --quiet HEAD -- package.json package-lock.json`

#### Ręczna weryfikacja:

- `npm run dev` ze stosem lokalnym. **Każde żądanie `curl`, które ma cokolwiek dowieść o naszym
  kodzie, musi nieść `-H "Origin: <dev>"`** — Astro wstawia kontrolę Origin na **początek** łańcucha
  middleware (`base-pipeline.js:150`, `internalMiddlewares.unshift(...)`), więc żądanie bez tego
  nagłówka dostaje 403 zanim dobiegnie do `PROTECTED_ROUTES` i nie dowodzi niczego o ochronie trasy.
  Trzy sprawdzenia: (a) `checkOrigin` — `curl -i -X POST <dev>/api/teams -d "composition=[]"` **bez**
  `Origin` → `403 Cross-site POST form submissions are forbidden`; (b) punkt kontrolny middleware —
  ten sam `curl` z `-H "Origin: <dev>"` i **bez** ciasteczka sesji → `302` na `/auth/signin`;
  (c) bramka progu — z `-H "Origin: <dev>"`, ciasteczkiem sesji konta A i `composition=[]` →
  `302` na `/teams/new?error=Every%20competency…`, tabela pusta
- Ten sam `curl` ze składem z przepisu (JSON z `characterId`/`perkIds` z `CHARACTER_POOL`) →
  `302` na `/teams/<uuid>/embark`; w Studio jeden wiersz z `user_id` konta A, ośmioznakową nazwą
  i składem identycznym z wysłanym
- `composition=not-json` → `302` z `?error=Invalid%20team%20payload`, brak nowego wiersza
- Kontrola mutacyjna: podmiana `isValid` na `violations.length === 0` w `gateTeamSubmission`
  czerwieni przypadek „sześć postaci bez perków" (drzewo przywrócone)

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie użytkownika przed Fazą 3.

---

## Faza 3: Wyspa i strona potwierdzenia

### Przegląd

Bramka z S-02 dostaje formularz, `/teams/new` pokazuje błędy zapisu, powstaje strona potwierdzenia.
Po tej fazie gwiazda przewodnia działa lokalnie od końca do końca.

### Wymagane zmiany:

#### 1. Bramka jako formularz

**Plik**: `src/components/team/EmbarkGate.tsx`

**Cel**: FR-018 + FR-007 — odblokowany przycisk wysyła skład; zablokowany nadal nie robi nic.

**Umowa**: props `{ ready: boolean; composition: TeamComposition }`. Renderuje
`<form method="POST" action="/api/teams">` z
`<input type="hidden" name={COMPOSITION_FIELD} value={JSON.stringify(composition)} />`
i wewnętrznym komponentem przycisku (w tym samym pliku), który bierze `pending` z `useFormStatus()`
i renderuje `Button type="submit" variant="cosmic" disabled={!ready || pending}` z ikoną `Rocket`
i etykietą „Embark on the job" (przy `pending`: „Embarking…"). **Bez `onSubmit`** — `disabled` jest
jedyną i wystarczającą barierą (patrz Krytyczne szczegóły implementacji → Specyfikacja UX
formularza). Tekst pod przyciskiem i `aria-describedby` bez zmian. Bez `fetch`, bez stanu.

#### 2. Spięcie w wyspie

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Przekazać skład do bramki.

**Umowa**: `<EmbarkGate ready={evaluation.isValid} composition={composition} />`. Nic więcej.

#### 3. Błąd zapisu na stronie kompozytora

**Plik**: `src/pages/teams/new.astro`

**Cel**: Trasa API wraca tu z `?error=`; strona musi go pokazać, inaczej odrzucenie jest nieme.

**Umowa**: frontmatter czyta `const error = Astro.url.searchParams.get("error")`; nad kartą
z wyspą (w gałęzi `pool`) renderuje `<ServerError message={error} />` z `@/components/auth/ServerError`
**bez** dyrektywy `client:*` (statyczny HTML — komponent nie ma stanu). Komentarz przy imporcie:
komponent mieszka w `auth/`, bo tam powstał; przenosiny poza zakresem.

#### 4. Strona potwierdzenia

**Plik**: `src/pages/teams/[id]/embark.astro` (nowy)

**Cel**: FR-019 — najpierw potwierdzenie zapisu z nazwą **odczytaną z bazy**, potem „Work in
Progress". Chroniona prefiksem `/teams` w middleware.

**Umowa**: frontmatter: `createClient()`; `null` → `return new Response(null, { status: 404 })`
(nieosiągalne — middleware przekierował). `getTeamSummary(supabase, Astro.params.id)` w `try`;
`null` → `404` (bez rozróżnienia „nie istnieje" od „cudza"); `throw` → `console.error` + stan
błędu w stylu `new.astro` („Team is unavailable right now", link na dashboard). Sukces: układ
z `confirm-email.astro` (karta `max-w-sm`, emoji 🚀, nagłówek gradientowy) z treścią w tej
kolejności: nagłówek „Team {name} is saved" (nazwa w `<code>`/monospace, żeby czytała się jak
hash); akapit potwierdzający zapis („Your crew is on the books under the call sign {name}."); wyraźnie
oddzielony blok „Work in Progress" („Missions are not part of this build — this is where the job
ends for now."); dwa linki: „Assemble another team" → `/teams/new`, „Back to dashboard" →
`/dashboard`. `<Layout title={\`Team ${name} saved\`}>`.

#### 5. Domknięcie wpisów w roadmapie

**Plik**: `context/foundation/roadmap.md`

**Cel**: Niewiadoma S-03 jest rozstrzygnięta; S-07 dostaje punkt kontrolny; niedomknięta roadmapa
była ustaleniem F1 przeglądu F-01.

**Umowa**: w bloku `### S-03` przepisać Niewiadomą na „**Rozstrzygnięte (2026-09-05, sesja
planowania):** nazwa losowa, generowana w bazie (`default` kolumny, 8 znaków hex), unikalna per
konto (`unique (user_id, name)`)". W bloku `### S-07` dopisać do Ryzyka: „**Punkt kontrolny z S-03
(2026-09-05):** `/teams/[id]/embark` zwraca gołe 404 dla nieznanego i cudzego id — prowizorycznie,
bez rozróżnienia; S-07 rozstrzyga docelowo (404 vs redirect na listę) i dokłada nawigację."
Trzecia edycja, w bloku `### S-03` → Ryzyko: zdanie „Klucz obcy z `teams` do `characters(id)` jest
przewidziany — zasiew puli działa upsertem, bez `delete`." zastąpić rozstrzygnięciem
„**Rozstrzygnięte (2026-09-05, sesja planowania):** skład trafia do kolumny `jsonb`, bez klucza
obcego do `characters` — pula jest zamknięta i zasiewana upsertem, więc FK nie kupuje integralności,
której schemat i tak nie ma." Bez tej edycji roadmapa zapowiada strukturę, której w bazie nie będzie
— dokładnie klasa ustalenia F1 z przeglądu F-01. Statusów nie zmieniać (robi to `/10x-implement` /
`/10x-archive`).

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx astro sync && npm run lint` przechodzi (react-compiler, react-hooks 7, jsx-a11y)
- `npm test` przechodzi
- `npm run build` przechodzi
- `git diff --quiet HEAD -- package.json package-lock.json`
- `grep -c "fetch(" src/components/team/EmbarkGate.tsx` zwraca 0

#### Ręczna weryfikacja:

- `npm run dev`, konto A, `/teams/new`: przy niedomkniętym progu przycisk zablokowany, klik nic
  nie robi; po przepisie z S-02 przycisk odblokowany; klik → przycisk pokazuje „Embarking…" →
  strona `/teams/<uuid>/embark` z „Team XXXXXXXX is saved", blokiem „Work in Progress" i dwoma
  linkami; nazwa zgadza się z kolumną `name` w Studio; `composition` w Studio równa się przepisowi
  (kolejność członków i perków zachowana)
- „Assemble another team" → pusty kompozytor; „Back to dashboard" → dashboard
- Konto B (drugie okno/prywatne): `/teams/<uuid-konta-A>/embark` → 404; `/teams/<nie-uuid>/embark`
  → 404 (nie stan błędu); wylogowany → redirect na `/auth/signin`
- Symulacja awarii: zatrzymany stos Supabase (`supabase stop`) → klik „Embark" → `/teams/new`
  z czerwonym komunikatem błędu i pustym składem (przyjęte); po `supabase start` zapis działa
- Odświeżenie `/teams/new` po zapisie: skład pusty, wykres wyzerowany (S-01), bez `?error=`

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie użytkownika przed Fazą 4 — dotyka
produkcji.

---

## Faza 4: Wdrożenie na projekt hostowany

### Przegląd

Migracja `teams` (i czekająca z F-02 `revoke_writes`) trafia na produkcję, potem worker. Faza
**w całości ręczna, wykonywana przez użytkownika**. Pierwsza zmiana schematu po wdrożeniu — rejestr
ryzyk wymaga notatki o wersji workera zgodnej ze schematem.

### Wymagane zmiany:

#### 1. Kroki operacyjne

**Plik**: brak zmian w kodzie.

**Umowa**: kolejność wiążąca:

1. `npx wrangler deployments list` → zapisz identyfikator **bieżącej** wersji workera (zgodnej ze
   schematem sprzed `teams`) w `deploy-plan.md` (patrz pkt 2).
2. `supabase migration list` → kontrola stanu zdalnego **przed** pushem: zdalny projekt ma mieć
   zastosowane `20260905081500` i `20260905081600`, a `20260905090700_…revoke_writes` oraz
   `<ts>_teams_schema` mają być wyłącznie lokalne. Każdy inny obraz oznacza dryf schematu
   i wstrzymuje push do wyjaśnienia.
3. `supabase db push` — CLI wypisze dwie migracje do zastosowania (`20260905090700_…revoke_writes`
   oraz `<ts>_teams_schema`); potwierdź. **`supabase config push` nie zostaje uruchomione** —
   zakaz z `AGENTS.md` bez wyjątku.
4. Dashboard Supabase: tabela `teams` istnieje, RLS włączone, dokładnie dwie polityki; na
   `characters`/`perks` przywileje zapisu dla `anon`/`authenticated` cofnięte.
5. `npx astro sync && npm run lint && npm test && npm run build`, potem `npx wrangler deploy`.
6. Test dymny na produkcji: konto testowe → przepis → „Embark" → strona potwierdzenia; wiersz
   w dashboardzie; drugie konto → 404 na tym `embark`.

#### 2. Dokumentacja wdrożenia

**Plik**: `context/deployment/deploy-plan.md`

**Cel**: Stan produkcji musi zgadzać się z dokumentem (lekcja F1 z przeglądu F-01).

**Umowa**: usunąć akapit „Oczekuje na `db push`" (`:150-155`) i dopisać obie migracje do listy
zastosowanych; dodać akapit „Pierwsza zmiana schematu po wdrożeniu (S-03)": wersja workera sprzed
i po, zasada „migracje addytywne — wycofaniem jest `wrangler rollback`, tabela zostaje"; w tabeli
rozstrzygnięć wobec rejestru ryzyk (`:169`) zastąpić „nie zmieniano schematu ani polityk RLS"
faktycznym rozstrzygnięciem.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Brak — faza nie zmienia kodu.

#### Ręczna weryfikacja:

- `supabase migration list` przed pushem pokazuje oczekiwany dryf (dwie migracje wyłącznie lokalne);
  `supabase db push` kończy się bez błędu i wypisuje obie jako zastosowane
- Dashboard: `teams` z RLS i dwiema politykami; `characters`/`perks` bez przywilejów zapisu dla `anon`/`authenticated`
- `supabase config push` **nie** uruchomiony; rejestracja testowa nadal wysyła link na adres produkcyjny
- Test dymny na produkcji przechodzi (zapis, potwierdzenie z nazwą, 404 z drugiego konta)
- `deploy-plan.md` odzwierciedla nowy stan: lista migracji, wersje workera, rozstrzygnięcie ryzyka

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/team-submission.test.ts` — parser (kształt, odrzucenia, usuwanie nadmiarowych pól,
  round-trip) i bramka (`findThresholdSolution` → `ok` potwierdzone przez `evaluateTeam`; bez
  perków, siódmy członek, trzeci perk, postać spoza puli, pusta tablica → `below-threshold`;
  nie-JSON → `invalid-payload`).
- `src/lib/team-repo.test.ts` — `isTeamId`.
- `src/lib/team-schema.test.ts` — wartownik migracji (RLS, polityki tylko `authenticated`,
  `revoke` dla `anon`, `default` nazwy, `unique`).

### Testy integracyjne:

- Brak zautomatyzowanych — z konstrukcji (brak Dockera w CI, twarda reguła czystości testów).
  Warstwa bazy, trasa i ekran weryfikowane ręcznie (dwa konta, `curl`, stos lokalny, produkcja).

### Kroki testowania ręcznego:

1. Faza 1: `db reset`; `insert`/`select` jako A, B, `anon`; `check` na obiekcie.
2. Faza 2: `curl` bez sesji → 302 signin; `[]` → `?error=`; przepis → `embark` + wiersz; śmieci → `?error=`.
3. Faza 3: pełna ścieżka w przeglądarce na A; 404 na B i na nie-UUID; awaria stosu → `?error=`.
4. Faza 4: `db push`, deploy, test dymny na produkcji, 404 z drugiego konta.

## Uwagi dotyczące wydajności

Bez budżetu wymagającego uwagi: zapis to jedno zapytanie o pulę (12 wierszy) + jeden `insert`;
`evaluateTeam` na serwerze kosztuje tyle co w wyspie. NFR „< 200 ms od wyboru" dotyczy wykresu
i bramki, które S-03 nie zmienia — formularz nie dokłada stanu ani efektów do wyspy.

## Uwagi dotyczące migracji

- Migracja `teams` jest **addytywna** i **niezmienna po `db push`** — zmiana kształtu po Fazie 4 to
  nowa migracja. Polityki `update`/`delete` dokładają S-05/S-06 własnymi migracjami.
- Push S-03 zastosuje też `20260905090700_character_pool_revoke_writes.sql` z F-02 — `deploy-plan.md`
  ma to odnotować.
- Kolejność na produkcji: migracja → worker. **Wycofanie rozpisane per migracja**, bo push zabiera
  dwie. Dla `teams` — `wrangler rollback` na zapisaną wersję workera; tabela zostaje, nieszkodliwa
  bez trasy, która do niej pisze. Dla `revoke_writes` — `wrangler rollback` **nic nie cofa**, bo to
  zmiana przywilejów w bazie, nie kodu; jej wycofaniem byłaby wyłącznie nowa migracja przywracająca
  granty. Ryzyko jest jednak zerowe: jedynym konsumentem `characters`/`perks` w aplikacji jest
  `getCharacterPool` (`src/lib/character-pool-repo.ts:88`, wyłącznie odczyt), a zasiew biegnie
  migracją jako `postgres`, którego revoke nie dotyczy.
- Zmiana propsów `EmbarkGate` (Faza 3) łamie kontrakt wewnątrz fragmentu; jedyny konsument to
  `TeamComposer`.

## Referencje

- Roadmapa: `context/foundation/roadmap.md` → `### S-03` (Ryzyko: punkt kontrolny `/api/teams`),
  `### S-07` (niewiadoma 404 vs redirect)
- Poprzednicy: `context/archive/2026-09-05-competency-radar-gate/plan.md` (§Czego NIE robimy —
  „nie przesądzamy kształtu zapisu"; przepis na skład), `context/archive/2026-08-30-solvable-character-pool/plan.md`
  (§Faza 2 — wzorzec migracji i RLS; §Faza 4 — wzorzec fazy produkcyjnej),
  `context/archive/2026-09-05-team-roster-composition/reviews/impl-review.md` (F5 — punkt
  kontrolny `PROTECTED_ROUTES`)
- Reguła i jej umowa: `src/lib/domain/evaluate-team.ts:22-40, 54`; solver do testów:
  `src/lib/domain/solvability.ts:129`
- Wzorzec repo z klientem jako argumentem: `src/lib/character-pool-repo.ts`
- Wzorzec trasy API i `?error=`: `src/pages/api/auth/signin.ts`; wzorzec formularza natywnego
  z `useFormStatus`: `src/components/auth/SignInForm.tsx:43`, `SubmitButton.tsx:12`
- Szablon strony potwierdzenia: `src/pages/auth/confirm-email.astro`
- Wzorzec testu czytającego migrację: `src/lib/domain/character-pool-sql.test.ts`
- Stan produkcji i zakaz `config push`: `context/deployment/deploy-plan.md:134-155, 169, 188`;
  rejestr ryzyk: `context/foundation/infrastructure.md:171-176`
- Wymagania: `context/foundation/prd.md` FR-007, FR-011, FR-018, FR-019, US-01, Guardrails
  „zapisana drużyna zawsze spełnia próg", „izolacja danych między kontami"

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Schemat `teams` w bazie

#### Automatyczne

- [x] 1.1 `npm test` przechodzi, w tym `src/lib/team-schema.test.ts` — 5260294
- [x] 1.2 `npx astro sync && npm run lint` przechodzi — 5260294
- [x] 1.3 Żaden test nie sięga po Supabase (`grep -rl "lib/supabase" --include='*.test.ts' src` pusty) — 5260294

#### Ręczne

- [x] 1.4 `supabase db reset` stosuje cztery migracje; `teams` z RLS i dokładnie dwiema politykami — 5260294
- [x] 1.5 Dwa konta: `insert` jako A przechodzi z ośmioznakową nazwą, `user_id` B odrzucony, `select` jako B i `anon` puste — 5260294
- [x] 1.6 `composition` jako obiekt odrzucony przez `check` — 5260294
- [x] 1.7 Wiersz testowy usunięty — 5260294

### Faza 2: Bramka zapisu poza interfejsem

#### Automatyczne

- [x] 2.1 `npm test` przechodzi, w tym `team-submission.test.ts` i `team-repo.test.ts` — 750cdb9
- [x] 2.2 `npx astro sync && npm run lint` przechodzi — 750cdb9
- [x] 2.3 `npm run build` przechodzi — 750cdb9
- [x] 2.4 Testy i nowe moduły `src/lib/` bez `astro:*` / `@/lib/supabase` — 750cdb9
- [x] 2.5 `package.json` / `package-lock.json` bez zmian — 750cdb9

#### Ręczne

- [x] 2.6 `curl` bez `Origin` → 403 (checkOrigin); z `Origin` bez sesji → 302 na `/auth/signin`; z `Origin` i sesją, `[]` → `?error=` o progu, tabela pusta — 750cdb9
- [x] 2.7 `curl` z przepisem → 302 na `/teams/<uuid>/embark`, wiersz z nazwą i identycznym składem — 750cdb9
- [x] 2.8 `composition=not-json` → `?error=Invalid team payload`, brak wiersza — 750cdb9
- [x] 2.9 Kontrola mutacyjna `isValid` → `violations.length === 0` czerwieni test (drzewo przywrócone) — 750cdb9

### Faza 3: Wyspa i strona potwierdzenia

#### Automatyczne

- [x] 3.1 `npx astro sync && npm run lint` przechodzi — 7df2b32
- [x] 3.2 `npm test` przechodzi — 7df2b32
- [x] 3.3 `npm run build` przechodzi — 7df2b32
- [x] 3.4 `package.json` / `package-lock.json` bez zmian — 7df2b32
- [x] 3.5 Brak `fetch(` w `EmbarkGate.tsx` — 7df2b32

#### Ręczne

- [x] 3.6 Pełna ścieżka na koncie A: zablokowany → przepis → „Embarking…" → strona potwierdzenia z nazwą z bazy; `composition` w Studio równa przepisowi — 7df2b32
- [x] 3.7 Linki „Assemble another team" i „Back to dashboard" działają — 7df2b32
- [x] 3.8 Konto B → 404 na cudzym `embark`; nie-UUID → 404; wylogowany → redirect na signin — 7df2b32
- [x] 3.9 Awaria stosu → `/teams/new` z komunikatem błędu i pustym składem; po starcie zapis działa — 7df2b32
- [x] 3.10 Odświeżenie `/teams/new` po zapisie zeruje skład bez `?error=` — 7df2b32

### Faza 4: Wdrożenie na projekt hostowany

#### Ręczne

- [x] 4.1 `supabase migration list` potwierdza stan zdalny; `supabase db push` stosuje `revoke_writes` i `teams_schema` bez błędu
- [x] 4.2 Dashboard: `teams` z RLS i dwiema politykami; `characters`/`perks` bez przywilejów zapisu
- [x] 4.3 `supabase config push` nie uruchomiony; potwierdzanie adresu na produkcji działa
- [x] 4.4 Test dymny na produkcji: zapis, potwierdzenie z nazwą, 404 z drugiego konta
- [x] 4.5 `deploy-plan.md` odzwierciedla listę migracji, wersje workera i rozstrzygnięcie ryzyka
