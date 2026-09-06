# Plan implementacji: Usunięcie drużyny po potwierdzeniu w oknie dialogowym (S-06)

## Przegląd

Gracz otwiera własną drużynę, wybiera usunięcie, potwierdza je w oknie dialogowym i wraca na listę
z potwierdzeniem; rezygnacja z okna zostawia drużynę nietkniętą, a usunięcie ostatniej drużyny
przywraca stan pusty z wezwaniem do utworzenia nowej (FR-010, US-03). Operacja jest nieodwracalna —
Non-Goal „kosz i przywracanie" obowiązuje, więc okno potwierdzenia jest **jedyną** ochroną.

Fragment domyka **D** z CRUD, a tym samym całą czwórkę operacji, od której zależy pierwsze
Kryterium sukcesu PRD („wszystkie cztery operacje CRUD są wykonalne z interfejsu").

## Analiza stanu obecnego

**Baza jest celowo zamknięta na usuwanie.** `supabase/migrations/20260905185700_teams_schema.sql:46`
robi `revoke update, delete, truncate on public.teams from authenticated`, a komentarz w liniach
12-14 przekazuje `delete` do S-06 „własną migracją, razem z `grant delete`". Nie ma polityki
`for delete`, więc dziś usunięcie przechodzi **bez błędu** i kasuje zero wierszy — awaria cicha.

**Ta granica jest zapisana jako test, który ten fragment musi rozbroić.**
`src/lib/teams-policy-sql.test.ts:77-82` — `it("żadna migracja nie nadaje jeszcze przywileju delete
na teams (to S-06)")` pójdzie na czerwono w chwili dodania migracji. To świadome przekazanie
zakresu, nie usterka; test czyta `supabase/migrations/` przez `node:fs` i strzyże komentarze przed
dopasowaniem (`:43-48`), bo migracje opisują prozą DDL, którego nie wydają.

**Warstwa danych ma gotowy wzorzec drugiego pisarza.** `src/lib/team-repo.ts:117-141` (`updateTeam`)
ustala trójwynikowy kontrakt: rekord (udało się), `null` (nie ma czego zapisać — nieznane id, cudzy
wiersz odcięty przez RLS, nie-UUID, nierozróżnialnie), `throw` (awaria zapytania). Zero wierszy
**nie jest awarią**. Klient wchodzi argumentem, moduł nie importuje `@/lib/supabase` ani `astro:*`,
a `isTeamId` (`:73-75`) pilnuje formatu przed każdym `.eq("id", …)`, żeby nie-UUID nie kończył się
Postgresowym `22P02`.

**Własność egzekwuje wyłącznie RLS.** `src/lib/team-repo.ts:11-14` — żadna funkcja nie filtruje po
`user_id`, bo drugi warunek sugerowałby, że RLS sam nie wystarcza. Konsekwencja zapisana jako stałe
ryzyko w przeglądach S-04 (F8) i S-05 (F1): produkcyjny `SUPABASE_KEY` **musi** zaczynać się od
`sb_publishable_`; klucz `sb_secret_` omija RLS w całości.

**Trasa zapisu ma sztywny, sprawdzalny kontrakt.** `src/pages/api/teams/[id].ts` — natywny formularz,
zero JSON w odpowiedziach, każda odmowa to `context.redirect` z `?error=`, żaden `throw` nie wychodzi
z handlera (nieprzechwycony throw w Workerze to 500). `null` z repo i `throw` dają gracz**owi ten
sam komunikat** (`:26-31`), różnią się wyłącznie poziomem logu — różnica w odpowiedzi ujawniałaby
istnienie cudzego rekordu (US-04).

**Strona szczegółów jest już hydratowana.** `src/pages/teams/[id].astro:115` renderuje
`<TeamComposer … client:load />`, ma slot `<ServerError message={error} />` (`:113`) i baner
`?saved=1` (`:108-112`) — oba **wyłącznie** w gałęzi sukcesu, żeby ekran 404 nie zdradził, że POST
w ogóle dotarł. 404 idzie przez `Astro.response.status = 404` (`:78-80`) i gałąź szablonu
renderującą `null`, nigdy przez top-level `return` (lekcja z S-03).

**Lista jest czystym SSR.** `src/pages/teams/index.astro` nie ma ani jednej dyrektywy `client:*`,
nie czyta `Astro.url.searchParams` i nie ma żadnego slotu na komunikat. Ma trzy gałęzie w ustalonej
kolejności: awaria odczytu (`teams === null`, `:60-70`), stan pusty (`:73-87`), lista (`:88-112`).

**Czego brakuje:** polityki `for delete` i przywileju `delete`; funkcji `deleteTeam` w repo; trasy
usuwającej; prymitywu `alert-dialog` (w `src/components/ui/` są dziś tylko `button.tsx` i
`dialog.tsx`); jakiegokolwiek przycisku usuwania; kanału `?deleted=1` na liście.

## Pożądany stan końcowy

Na `/teams/<id>` obok kompozytora stoi przycisk „Delete team". Kliknięcie otwiera modalne okno
`role="alertdialog"`, które nazywa drużynę po nazwie-hashu i mówi wprost, że operacji nie da się
cofnąć. „Cancel" zamyka okno i nie robi nic. „Delete team" wysyła natywny formularz na
`POST /api/teams/<id>/delete`; po udanym usunięciu gracz ląduje na `/teams?deleted=1` z zielonym
banerem — nad listą, jeśli zostały inne drużyny, albo nad stanem pustym z wezwaniem „Assemble your
first team", jeśli to była ostatnia. Odmowa wraca na `/teams/<id>?error=…`.

**Komunikat odmowy widzi wyłącznie gałąź `throw` na własnym, istniejącym wierszu.** `[id].astro:78-81`
liczy `notFound = !teamFailed && team === null`, a szablon (`:82`) renderuje wtedy `null` — całą
stronę, nie tylko baner; slot `<ServerError>` (`:113`) żyje dopiero w gałęzi sukcesu (`:102`). Więc
`deleteTeam` → `null` (cudze id, nieznane id, nie-UUID) i `createClient` → `null` kończą się **gołym
404 bez tekstu**. Jest to przyjęte świadomie: dokładnie to samo daje dziś GET na cudze id, więc nie
powstaje nowy kanał enumeracji (US-04), a z interfejsu ta ścieżka jest nieosiągalna — przycisk stoi
tylko przy własnym wierszu. Rozstrzygnięcie „404 vs redirect" należy do S-07.

Weryfikacja: dwa konta, drużyna każdego. Usunięcie własnej znika z listy i nie wraca po odświeżeniu;
`POST` na id drużyny drugiego konta nie zmienia niczego u tamtego konta i daje ten sam komunikat
co awaria; `npm test` przechodzi z przepisanym `teams-policy-sql.test.ts`.

### Kluczowe odkrycia

- `supabase/migrations/20260905185700_teams_schema.sql:44-46` — RLS domyka UPDATE/DELETE (brak
  polityk = zero wierszy), ale **nie dotyczy TRUNCATE**; ten filtruje wyłącznie przywilej. Dlatego
  strażnik `truncate` musi zostać w teście, gdy zdejmujemy strażnik `delete`.
- `src/lib/teams-policy-sql.test.ts:77-82` — czerwony test do przepisania, nie do usunięcia.
- `src/lib/team-repo.ts:117-141` — wzorzec `updateTeam` do skopiowania punkt po punkcie.
- `src/pages/api/teams/[id].ts:33-100` — wzorzec trasy: `id = context.params.id ?? ""` **tylko** do
  budowy adresu, surowy `context.params.id` do repo bez zawężania.
- `src/pages/teams/[id].astro:113` — istniejący slot `<ServerError>`, w który wpada `?error=`.
- `src/components/team/MemberPickerDialog.tsx:33` — `DialogContent` dostaje nadpisujący
  `className="border-white/10 bg-[#0f1529] text-white"`, bo prymityw shadcn wchodzi z jasnymi
  tokenami `bg-background`. `AlertDialogContent` będzie potrzebował tego samego.
- `context/foundation/lessons.md` §1 — obowiązkowa korekta importów po `npx shadcn add`.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` zawiera `/teams` i `/api/teams`, dopasowanie przez
  `startsWith`, więc nowa trasa jest osłonięta **bez żadnej zmiany w middleware**.

## Czego NIE robimy

- **Przycisku usuwania na liście `/teams`** — `index.astro` zostaje czystym SSR. Dialog to stan
  kliencki, więc przycisk na liście otwierałby nową granicę hydratacji na stronie, która dziś nie
  wysyła ani bajta JS. US-03 opisuje ścieżkę „otwiera drużynę → wybiera usunięcie".
- **Miękkiego usuwania (`deleted_at`), kosza i przywracania** — Non-Goal PRD. `delete` kasuje wiersz.
- **Rozstrzygnięcia 404 vs redirect dla cudzego id** — to należy do S-07
  (`cross-account-team-isolation`); tutaj cudze id kończy się tym samym komunikatem co awaria.
- **Nawigacji i przycisku usuwania na `/teams/[id]/embark`** — ekran potwierdzenia pierwszego zapisu
  zostaje bez zmian.
- **Zmian w `TeamComposer`, `CompositionGate` i bramce progu** — usuwanie nie dotyka reguły domenowej
  ani `gateTeamSubmission`.
- **Slotu `<ServerError>` na liście `/teams`** — odmowa wraca na stronę szczegółów, która taki slot
  już ma dla gałęzi `throw`; dla gałęzi `null` odmowa kończy się gołym 404 i to jest zamierzone
  (§Pożądany stan końcowy). Lista dostaje wyłącznie baner sukcesu.
- **Wydzielenia `src/lib/team-composition.ts`** — follow-up F7 z przeglądu S-04 zostaje follow-upem:
  trasa usuwania nie konsumuje kształtu składu, więc trzeci importer `toTeamComposition` nadal nie
  powstaje.
- **Zmian w `src/middleware.ts`** — prefiksy `/teams` i `/api/teams` już pokrywają nowe trasy.

## Podejście do implementacji

Kolejność „od bazy do ekranu", ta sama co w S-05: każda faza jest samodzielnie weryfikowalna,
a każda wcześniejsza bezpieczna bez późniejszych. Baza dostaje przywilej usuwania, zanim istnieje
cokolwiek, co go użyje; trasa jest sprawdzalna `curl`-em, zanim istnieje jakikolwiek przycisk;
ekran wchodzi na końcu, w całości jednym commitem.

Centralna decyzja: **usuwanie dostaje własną trasę, nie własny czasownik**. Natywny formularz umie
wyłącznie GET i POST, a kontrakt tego projektu — „natywny formularz, zero JSON, każda gałąź to
redirect" — jest tym, co czyni trasy zapisu sprawdzalnymi mechanicznie. `export const DELETE`
wymagałoby pierwszego w projekcie `fetch`, a rozgałęzianie istniejącego `POST /api/teams/[id]` po
ukrytym polu przepuściłoby usuwanie przez bramkę progu i parsowanie składu — dokładnie te gwarancje,
których pilnują dzisiejsze grepy. Stąd osobny plik `src/pages/api/teams/[id]/delete.ts`.

Druga decyzja: **usuwanie nie wchodzi do `TeamComposer`**. Ta wyspa dopiero co pozbyła się trybu
`readOnly` (S-05, lekcja o parze przełączników); dokładanie do niej warunkowego przycisku, którego
`/teams/new` nigdy nie użyje, przywracałoby ten sam problem inną drogą. Osobna wyspa
`DeleteTeamDialog` ma jeden tryb i jedno zadanie.

## Krytyczne szczegóły implementacji

**Formularz musi żyć **wewnątrz** `AlertDialogContent`, nie wokół niego.** Radix renderuje treść
okna przez portal do `document.body`, więc `<form>` owinięty wokół `<AlertDialog>` w drzewie React
**nie obejmie** przycisku potwierdzenia w DOM — submit nigdy nie wystartuje, a awaria jest cicha:
przycisk zamknie okno i nic się nie stanie. `<form method="post" action="/api/teams/<id>/delete">`
idzie do `AlertDialogFooter`.

**Przycisk potwierdzenia nie może być `AlertDialogAction`.** Ten prymityw jest zbudowany na
`DialogPrimitive.Close` (`@radix-ui/react-alert-dialog/dist/index.mjs:81-86`), a `DialogClose` ma
bezwarunkowe `onClick: () => context.onOpenChange(false)`
(`@radix-ui/react-dialog/dist/index.mjs:272-286`). Klik zamyka okno w tym samym zdarzeniu, w którym
przeglądarka miałaby uruchomić submit — odłączony przycisk nie ma właściciela formularza i POST nie
wychodzi. Awaria jest cicha i **tej samej klasy** co pułapka portalu powyżej. Jedyne, co ją dziś
maskuje, to animacja wyjścia trzymana przez `Presence` do `animationend` — czyli klasa CSS w pliku
generowanym przez CLI. Potwierdzenie jest więc zwykłym `<Button type="submit">` wewnątrz formularza;
okno zamyka nawigacja po 302, nie handler Radiksa. `AlertDialogCancel` zostaje bez zmian —
zamknięcie jest jego jedynym zadaniem.

**`delete … returning` przechodzi przez politykę `select`.** Kontrakt `TeamSummary | null` opiera się
na tym, że skasowany wiersz wraca — a wraca tylko dlatego, że polityka `owner can read teams`
(`20260905185700_teams_schema.sql:37-39`) go przepuszcza. Migracja ma to nazwać w komentarzu, bo
zmiana polityki `select` w przyszłości rozbroiłaby rozróżnienie „null" od „usunięto" bez błędu.

**Polityka `for delete` nie przyjmuje `with check`.** Postgres odrzuca `with check` na polityce
delete (nie ma nowego wiersza do sprawdzenia) — inaczej niż polityka `update`, którą S-05 celowo
wyposażył w oba. Nie jest to niedopatrzenie i test SQL nie może tego asercjonować.

**Przywilej `delete` jest z konieczności tabelowy.** Kolumnowa granulacja istnieje dla `update`
i `insert`, nie dla `delete` — nie ma czego zawęzić. Bariera przeciw skasowaniu cudzego wiersza jest
w polityce `using`, nie w grancie.

**Baner `?deleted=1` nie może wpaść do gałęzi awarii odczytu.** Na `/teams` trzy gałęzie są
rozłączne; „Team deleted." nad ekranem „Your teams are unavailable right now" to sprzeczny sygnał.
Baner idzie nad stan pusty i nad listę — czyli obie gałęzie udanego odczytu.

---

## Faza 1: Baza i warstwa danych

### Przegląd

Baza zaczyna pozwalać na usunięcie własnego wiersza, repo dostaje `deleteTeam`, a test SQL zamienia
przestarzałą granicę zakresu na asercje pozytywne plus strażnika `truncate`/`anon`. Po tej fazie
**nic w interfejsie się nie zmienia** — nie ma jeszcze wywołującego.

### Wymagane zmiany

#### 1. Migracja z polityką i przywilejem usuwania

**Plik**: `supabase/migrations/20260906120000_teams_delete_policy.sql` (nowy)

**Cel**: Domknąć zobowiązanie z `20260905185700_teams_schema.sql:12-14`. Bez tego pliku usunięcie
przechodzi bez błędu i kasuje zero wierszy — awaria cicha, nie do odróżnienia od „cudza drużyna".

**Umowa**: `create policy "owner can delete teams" on public.teams for delete to authenticated
using (user_id = (select auth.uid()));` plus `grant delete on public.teams to authenticated;`.
`(select auth.uid())` zamiast gołego `auth.uid()`, jak w trzech istniejących politykach. Bez
`with check` (Postgres go tu nie przyjmuje). Nagłówek komentarza w stylu
`20260906090000_teams_update_policy.sql`: co nadaje, dlaczego grant jest tabelowy (brak kolumnowej
granulacji dla `delete`), że `delete … returning` przechodzi przez politykę `select`, oraz czego plik
**nie** nadaje (`truncate` zostaje cofnięty, nic dla `anon`). W tej prozie nie może paść dosłowny
ciąg `grant … truncate` — kryterium 1.9 grepuje **surowe** pliki, więc zdanie o przywileju
wywróciłoby własną bramkę.

#### 2. `deleteTeam` w repozytorium drużyn

**Plik**: `src/lib/team-repo.ts`

**Cel**: Trzecia i ostatnia operacja zapisu do `teams`, w kształcie, którego wywołujący nie pomyli
z awarią. Aktualizacja docstringu modułu (`:11-14`) o politykę `delete`.

**Umowa**: `export async function deleteTeam(supabase: SupabaseClient, id: string | undefined):
Promise<TeamSummary | null>`. `isTeamId` przed zapytaniem → `null`; `.from("teams").delete()
.eq("id", id).select(SUMMARY_SELECT).maybeSingle()`; `error` → `throw new Error(\`Failed to delete
team ${id}: ${error.message}\`, { cause: error })`; brak wiersza → `null`. Docstring nazywa trzy
wyniki dokładnie jak `updateTeam:111-115` i mówi, że zero wierszy nie jest awarią. Żadnego filtra
po `user_id` — własność zostaje przy RLS.

#### 3. Przepisany strażnik SQL

**Plik**: `src/lib/teams-policy-sql.test.ts`

**Cel**: Zdjąć asercję „S-06 jeszcze nie nadał delete", która właśnie się zdezaktualizowała,
i postawić na jej miejscu bariery, których nie widzi ani lint, ani typy.

**Umowa**: Usuń `it("żadna migracja nie nadaje jeszcze przywileju delete na teams (to S-06)")`
(`:77-82`). Dodaj trzy asercje: (a) `latestMigration("_teams_delete_policy.sql")` zawiera
`for delete to authenticated` oraz `using (user_id = (select auth.uid()))`; (b) ta sama migracja
zawiera `grant delete on public.teams to authenticated`; (c) na `allMigrationsWithoutComments()` —
żadna migracja nie nadaje `truncate` na `public.teams` ani niczego dla `anon` na tej tabeli.

**Obie asercje z (c) muszą być zakotwiczone na `grant\s`**, wzorem `grantsUpdateOnWholeTable`
(`:73`). Helper strzyże wyłącznie komentarze — `revoke` w korpusie **zostaje**, a są tam dokładnie
dwa zdania, które naiwny wzorzec złapie jako fałszywe trafienie:
`revoke update, delete, truncate on public.teams from authenticated;` (`20260905185700:46`) oraz
`revoke all on public.teams from anon;` (`:44`). Bez kotwicy na `grant` nowy strażnik idzie na
czerwono natychmiast — na migracji, której właśnie pilnuje.
Zaktualizuj tytuł `describe` i nagłówkowy docstring pliku, bo przedmiotem testu nie jest już sam
`update`. Test dalej czyta wyłącznie przez `node:fs` — bez Supabase, bez `astro:*`.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- `npx astro sync && npm run lint` przechodzi
- `npm test` przechodzi (w tym przepisany `teams-policy-sql.test.ts`)
- `npm run build` przechodzi
- Migracja istnieje i nadaje politykę oraz przywilej:
  `grep -q "for delete to authenticated" supabase/migrations/20260906120000_teams_delete_policy.sql && grep -q "grant delete on public.teams to authenticated" supabase/migrations/20260906120000_teams_delete_policy.sql`
- Polityka delete nie ma `with check`:
  `! grep -n "with check" supabase/migrations/20260906120000_teams_delete_policy.sql`
- Repo nadal nie filtruje po `user_id`: `! grep -n 'eq("user_id"' src/lib/team-repo.ts`
- Repo nadal nie importuje warstwy Astro/Supabase: `! grep -nE 'from "astro|@/lib/supabase' src/lib/team-repo.ts`
- Nieaktualna granica zakresu zniknęła: `! grep -n "to S-06" src/lib/teams-policy-sql.test.ts`
- Żaden przywilej usuwania nie wyciekł poza tabelowy `delete`:
  `! grep -rn "grant all\|grant.*truncate" supabase/migrations/`
  (kotwica na `grant`, nie na samym `truncate`: `grep` biegnie po **surowych** plikach, a nagłówek
  nowej migracji ma w prozie wyjaśnić, że `truncate` zostaje cofnięty — wzorzec na samym słowie
  trafiłby we własny komentarz i w `revoke … truncate` ze `20260905185700:46`)
- Żadna trasa ani komponent nie woła jeszcze `deleteTeam`:
  `! grep -rn "deleteTeam" src/pages/ src/components/`

#### Ręczna weryfikacja

- `supabase db push` stosuje migrację bez błędu
- Panel Supabase pokazuje na `public.teams` dokładnie cztery polityki: insert, select, update, delete
- **Warunek stały przed Fazą 2**: produkcyjny `SUPABASE_KEY` zaczyna się od `sb_publishable_`
  (`npx wrangler secret list` + weryfikacja wartości u źródła). Klucz `sb_secret_` omija RLS
  w całości, a od tej fazy omijanie RLS znaczy „kasowanie cudzych drużyn", nie „czytanie".
  Ryzyko przeniesione z przeglądów S-04 (F8) i S-05 (F1); sprawdzane **przed** fazą, która dowozi
  trasę usuwającą.

---

## Faza 2: Trasa usuwania

### Przegląd

Trzeci i ostatni pisarz do `teams`. Sprawdzalny `curl`-em, zanim powstanie jakikolwiek przycisk.

### Wymagane zmiany

#### 1. `POST /api/teams/[id]/delete`

**Plik**: `src/pages/api/teams/[id]/delete.ts` (nowy)

**Cel**: Przyjąć natywny submit z okna potwierdzenia, usunąć **własny** wiersz i odesłać gracza —
na listę po sukcesie, na stronę drużyny po odmowie. Kształt `src/pages/api/teams/[id].ts` punkt po
punkcie, minus wszystko, co dotyczy składu: trasa nie czyta ciała, nie parsuje składu i nie zna progu.

**Umowa**: `export const POST: APIRoute`. `const id = context.params.id ?? ""` **wyłącznie** do
budowy adresów; do repo idzie surowy `context.params.id` (formatu pilnuje `isTeamId`).
`const reject = (message: string) => \`/teams/${id}?error=${encodeURIComponent(message)}\``.
Stała modułowa `DELETE_FAILED_MESSAGE` — jeden tekst dla **dwóch różnych** stanów (`null` z repo
i awaria zapytania), dokładnie jak `SAVE_FAILED_MESSAGE` w `[id].ts:26-31`. Pięć gałęzi, każda
zakończona `return context.redirect(...)`:
1. `!context.locals.user` → `/auth/signin` (obrona w głąb; prefiks `/api/teams` jest w `PROTECTED_ROUTES`)
2. `createClient(...)` zwraca `null` → `reject("Supabase is not configured")`
3. `deleteTeam` zwraca `null` → `console.warn` + `reject(DELETE_FAILED_MESSAGE)`
4. sukces → `/teams?deleted=1`
5. `catch` → `console.error` + `reject(DELETE_FAILED_MESSAGE)`

Bez `formData()` — formularz nie niesie ładunku, a `@supabase/ssr` ustawia ciasteczka
`sameSite: "lax"`, więc obce POST-y i tak przychodzą nieuwierzytelnione (ustalenie z przeglądu S-05).
Żaden `throw` nie wychodzi z handlera. Docstring nagłówkowy nazywa: trzeci pisarz, brak ładunku,
brak bramki progu, oraz dlaczego `null` i `throw` mają wspólny komunikat (US-04 — brak kanału
enumeracji).

### Kryteria sukcesu

#### Automatyczna weryfikacja

- `npx astro sync && npm run lint` przechodzi
- `npm test` przechodzi
- `npm run build` przechodzi
- Zero JSON w odpowiedziach:
  `! grep -nE "Response\.json|new Response|JSON\.stringify" 'src/pages/api/teams/[id]/delete.ts'`
- Każdy `return` to przekierowanie:
  `test "$(grep -c 'return ' 'src/pages/api/teams/[id]/delete.ts')" = "$(grep -c 'context.redirect' 'src/pages/api/teams/[id]/delete.ts')"`
- Trasa nie zna reguły domenowej ani składu:
  `! grep -nE "gateTeamSubmission|COMPOSITION_FIELD|evaluateTeam|COMPETENCY_THRESHOLD|formData" 'src/pages/api/teams/[id]/delete.ts'`
- Jeden komunikat, dwie gałęzie odmowy — mierzone na użyciach, nie na wystąpieniach nazwy, żeby
  docstring mógł stałą nazwać po imieniu:
  `test "$(grep -c 'reject(DELETE_FAILED_MESSAGE)' 'src/pages/api/teams/[id]/delete.ts')" = "2"`
- Cel przekierowania sukcesu jest dokładnie jeden:
  `grep -q '"/teams?deleted=1"' 'src/pages/api/teams/[id]/delete.ts'`
- Middleware nietknięty: `git diff --name-only HEAD -- src/middleware.ts` nie zwraca nic
- Żaden komponent nie woła jeszcze tej trasy: `! grep -rn "/delete" src/components/ src/pages/teams/`

#### Ręczna weryfikacja

- Zalogowany `curl -i -X POST --cookie <sesja> http://localhost:4321/api/teams/<własne-id>/delete`
  odpowiada 302 na `/teams?deleted=1`, a wiersz znika z `/teams`
- To samo żądanie na id drużyny **drugiego konta** odpowiada 302 na `/teams/<id>?error=…`, a drużyna
  drugiego konta jest po nim nadal widoczna na jego liście (US-04, FR-010). Strona pod tym adresem
  to **puste 404 bez komunikatu** — `?error=` jest tam celowo martwy, bo `<ServerError>` żyje tylko
  w gałęzi sukcesu; to nie jest regres
- To samo żądanie na id, które nie jest UUID (`.../api/teams/not-a-uuid/delete`) daje ten sam
  komunikat co wyżej — bez 500 i bez błędu Postgresa w logach
- Żądanie bez ciasteczka sesji kończy się przekierowaniem na `/auth/signin`

---

## Faza 3: Ekran

### Przegląd

Prymityw `alert-dialog`, wyspa `DeleteTeamDialog` osadzona na `/teams/[id]` i baner `?deleted=1`
na `/teams`. **Cała faza to jeden commit**: wyspa bez osadzenia jest martwym kodem, osadzenie bez
`client:load` daje przycisk, który nic nie robi (lekcja z S-04 o parze przełączników), a trasa
odsyłająca na `?deleted=1` bez banera nie dowozi potwierdzenia z wyniku S-06.

### Wymagane zmiany

#### 1. Prymityw `alert-dialog`

**Plik**: `src/components/ui/alert-dialog.tsx` (nowy, generowany)

**Cel**: Modalne okno o semantyce `role="alertdialog"` — nie zamyka się kliknięciem w tło, co dla
operacji nieodwracalnej jest właściwością, nie ozdobą.

**Umowa**: `npx shadcn@latest add alert-dialog`, a następnie **obowiązkowa korekta importów**
z `context/foundation/lessons.md` §1: zamień `import { AlertDialog as AlertDialogPrimitive } from
"radix-ui"` na `import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"` i dodaj ten
pakiet do `dependencies`; zamień `from "cn"` na `from "@/lib/utils"`. Poza tymi importami i tym,
co wymusi prettier — nic więcej. `components.json` i `src/styles/global.css` mają zostać nietknięte,
a `package-lock.json` wolny od `radix-ui` i `cn`.

#### 2. Wyspa potwierdzenia

**Plik**: `src/components/team/DeleteTeamDialog.tsx` (nowy)

**Cel**: Przycisk „Delete team" i okno potwierdzenia nazywające drużynę po nazwie-hashu oraz mówiące
wprost, że operacji nie da się cofnąć. Osobny komponent, żeby `TeamComposer` nic nie wiedział
o usuwaniu.

**Umowa**: `export default function DeleteTeamDialog({ teamId, teamName }: { teamId: string;
teamName: string })`. Stan otwarcia w `useState`. Trigger: `<Button variant="destructive">`
z nadpisującym `className` w stylu `MemberPickerDialog.tsx:33` — wariant `destructive` siedzi na
tokenie `bg-destructive` (`button.tsx:11-22`), a `/teams/[id]` jest w całości ręcznym „cosmic"
(`bg-cosmic`, `border-white/10`, `bg-white/5`), więc goły token odstaje od ekranu tak samo jak
jasne tło `DialogContent`. Ten sam przycisk jest potwierdzeniem w stopce okna (patrz niżej).
`AlertDialogContent` dostaje nadpisujący `className="border-white/10 bg-[#0f1529] text-white"` —
prymityw shadcn wchodzi z jasnymi tokenami `bg-background`, tak samo jak `DialogContent`
w `MemberPickerDialog.tsx:33`. W `AlertDialogFooter`: `AlertDialogCancel` z tekstem „Cancel" oraz
`<form method="post" action={\`/api/teams/${teamId}/delete\`}>` zawierający
`<Button type="submit" variant="destructive">Delete team</Button>`.
**Bez `AlertDialogAction`** — jest zbudowany na `DialogPrimitive.Close`, więc zamknąłby okno w tym
samym zdarzeniu, w którym miałby wystartować submit (§Krytyczne szczegóły implementacji); okno
zamyka nawigacja po 302. Formularz **wewnątrz** treści okna — Radix portuje ją do `document.body`,
więc formularz owinięty wokół `<AlertDialog>` nie objąłby przycisku w DOM. Zero `fetch`,
zero `onSubmit`.

#### 3. Osadzenie na stronie szczegółów

**Plik**: `src/pages/teams/[id].astro`

**Cel**: Udostępnić usuwanie tam, gdzie US-03 każe go szukać, bez ruszania kompozytora.

**Umowa**: W gałęzi sukcesu (`composition !== null && pool !== null`, `:102`) dołóż
`<DeleteTeamDialog teamId={team.id} teamName={team.name} client:load />` pod kontenerem
`TeamComposer`. Wyspa żyje **wyłącznie** w tej gałęzi — na ekranie 404 i „drużyna niedostępna"
nie ma czego usuwać, a jej obecność zdradziłaby istnienie wiersza. `client:load` i wyspa wchodzą
razem, w jednej edycji.

#### 4. Baner potwierdzenia na liście

**Plik**: `src/pages/teams/index.astro`

**Cel**: Potwierdzić usunięcie — także wtedy, gdy zniknęła ostatnia drużyna i lista nie ma czego
pokazać jako dowodu (wynik S-06 w roadmapie).

**Umowa**: We frontmatterze `const deleted = Astro.url.searchParams.has("deleted");`. W szablonie
zielony baner w stylu `src/pages/teams/[id].astro:108-112` („Team deleted."), renderowany nad
gałęzią stanu pustego **i** nad gałęzią listy — czyli wewnątrz `<Fragment>` (`:72`), nad wyrażeniem
warunkowym, nie w gałęzi `teams === null`. Strona zostaje czystym SSR: żadnej dyrektywy `client:*`.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- `npx astro sync && npm run lint` przechodzi
- `npm test` przechodzi
- `npm run build` przechodzi
- Importy prymitywu poprawione zgodnie z lekcją:
  `! grep -nE 'from "radix-ui"|from "cn"' src/components/ui/alert-dialog.tsx`
- Pakiet per-prymityw w zależnościach: `grep -q '"@radix-ui/react-alert-dialog"' package.json`
- Generator nie przemycił obcych pakietów:
  `! grep -n 'node_modules/radix-ui"\|node_modules/cn"' package-lock.json`
- Konfiguracja shadcn i style nietknięte:
  `git diff --name-only HEAD~1 -- components.json src/styles/global.css` nie zwraca nic
- Formularz, nie `fetch`: `! grep -rnE "fetch\(|onSubmit" src/components/team/DeleteTeamDialog.tsx`
  oraz `grep -q 'method="post"' src/components/team/DeleteTeamDialog.tsx`;
  submit nie przechodzi przez `Close`:
  `! grep -n "AlertDialogAction" src/components/team/DeleteTeamDialog.tsx`
- `TeamComposer` nie wie o usuwaniu:
  `! grep -nE "delete|Delete" src/components/team/TeamComposer.tsx`
- Strona szczegółów ma dokładnie dwie wyspy:
  `test "$(grep -c 'client:load' 'src/pages/teams/[id].astro')" = "2"`
- Lista zostaje czystym SSR: `! grep -n "client:" src/pages/teams/index.astro`
- Cała faza jednym commitem: `git show --stat HEAD` wymienia razem
  `src/components/ui/alert-dialog.tsx`, `src/components/team/DeleteTeamDialog.tsx`,
  `src/pages/teams/[id].astro`, `src/pages/teams/index.astro`, `package.json`, `package-lock.json`

#### Ręczna weryfikacja

- Na `/teams/<id>` przycisk „Delete team" otwiera modalne okno; okno nazywa drużynę po nazwie-hashu
  i mówi, że operacji nie da się cofnąć
- Escape oraz „Cancel" zamykają okno i **nie** usuwają drużyny — po odświeżeniu drużyna nadal jest
  na liście (US-03: „rezygnacja z potwierdzenia pozostawia drużynę nietkniętą")
- Kliknięcie w tło **nie** zamyka okna (właściwość `alertdialog`, odróżnia je od `MemberPickerDialog`)
- „Delete team" kończy się na `/teams` z banerem „Team deleted.", a drużyna zniknęła z listy
- Usunięcie **ostatniej** drużyny pokazuje baner nad stanem pustym z wezwaniem „Assemble your first
  team", nie zero wyników (US-01, wynik S-06)
- Ekran 404 (`/teams/<nieistniejące-uuid>`) nie pokazuje przycisku usuwania
- Zapis składu z S-05 nadal działa: zmiana perka i „Wyrusz na zlecenie" kończy się `?saved=1`

---

## Strategia testowania

### Testy jednostkowe

- `src/lib/teams-policy-sql.test.ts` — jedyny nowy test automatyczny, rozszerzony o trzy asercje
  (polityka `for delete` z `using`, tabelowy `grant delete`, brak `truncate`/`anon`). Czyta migracje
  przez `node:fs`, więc mieści się w twardej regule czystości testów.
- `deleteTeam` **nie dostaje testu jednostkowego** — jak `updateTeam`, `listTeams` i `getTeamDetail`
  wymaga klienta Supabase, a testy w tym repo nie bootstrapują Supabase. Testowalna jest wyłącznie
  czysta część repo (`isTeamId`), która nie zmienia się w tym fragmencie.

### Testy integracyjne

Brak — projekt nie ma harnessu integracyjnego, a `npm test` to jeden przebieg Vitest nad
`src/**/*.test.ts`. Zachowanie end-to-end jest weryfikowane ręcznie poniżej, na dwóch kontach.

### Kroki testowania ręcznego

1. `supabase db push`, potem `npm run dev`. Zaloguj się na konto A z co najmniej dwiema drużynami.
2. Otwórz `/teams/<id>`, kliknij „Delete team", naciśnij Escape. Odśwież — drużyna nadal istnieje.
3. Otwórz okno ponownie, kliknij w tło. Okno zostaje otwarte (`alertdialog`). Kliknij „Cancel".
   Odśwież — drużyna nadal istnieje.
4. Otwórz okno i potwierdź. Ląduje na `/teams` z banerem „Team deleted."; drużyny nie ma na liście
   ani po odświeżeniu.
5. Usuń pozostałe drużyny konta A. Ostatnie usunięcie pokazuje baner **nad** stanem pustym
   z przyciskiem „Assemble your first team".
6. Zaloguj się na konto B, zapisz drużynę, zanotuj jej id. Wróć na konto A i wyślij
   `curl -i -X POST` z ciasteczkiem konta A na `/api/teams/<id-konta-B>/delete`. Odpowiedź to 302 na
   `/teams/<id>?error=…`; zaloguj się na B i potwierdź, że drużyna jest nietknięta (US-04).
7. Wywołaj tę samą trasę z id, które nie jest UUID. Brak 500, brak `22P02` w logach, ten sam
   komunikat co w kroku 6.
8. Na koncie A zapisz nową drużynę, zmień perka i zapisz (`?saved=1`), potem ją usuń — obie ścieżki
   zapisu i ścieżka usuwania działają na tym samym rekordzie bez kolizji.

## Uwagi dotyczące wydajności

Brak implikacji. Usunięcie to jedno zapytanie po kluczu głównym z indeksem `teams_user_id_idx`
w tle RLS; strona listy wykonuje dokładnie ten sam odczyt co dotąd. Wyspa `DeleteTeamDialog` dokłada
drugi bundle React na `/teams/[id]`, ale strona już wysyła JS przez `TeamComposer` — `/teams`
i `/teams/new` zostają bez zmian. Wymaganie „poniżej 200 ms" dotyczy wykresu i przycisku
„Wyrusz na zlecenie", których ten fragment nie dotyka.

## Uwagi dotyczące migracji

Jedna nowa migracja, wyłącznie DDL uprawnień — bez zmian w schemacie i bez przenoszenia danych,
więc `supabase db push` jest jedyną sankcjonowaną ścieżką (AGENTS.md: nigdy `supabase config push`).
Migracja jest przyrostowa: nie dotyka polityk `insert`, `select` ani `update` i nie odwraca
`revoke … truncate` z `20260905185700_teams_schema.sql:46`.

Wycofanie: usunięcie polityki i przywileju (`drop policy "owner can delete teams" on public.teams;`
`revoke delete on public.teams from authenticated;`) osobną, nową migracją — raz zastosowanej
migracji się nie nadpisuje. Wycofanie samego kodu bez bazy jest bezpieczne: przywilej bez
wywołującego nic nie robi.

**Dane usuniętych drużyn nie mają ścieżki powrotu** — Non-Goal PRD. Po `supabase db push` na
produkcji gracze mogą trwale kasować własne rekordy.

## Referencje

- Element mapy drogowej: `context/foundation/roadmap.md` §S-06 (`delete-team-confirmed`), linie 284-296
- Wymaganie wstępne: `context/archive/2026-09-06-own-teams-list-and-detail/plan.md` (lista i szczegóły)
- Wzorzec drugiego pisarza: `context/archive/2026-09-06-edit-saved-team/plan.md` (kolejność
  „od bazy do ekranu", kryteria mechaniczne trasy)
- Wiążąca lekcja: `context/foundation/lessons.md` §„Po `npx shadcn add` popraw importy na pakiety
  per-prymityw" (wymienia `alert-dialog` w S-06 wprost)
- Wiążąca lekcja: `context/foundation/lessons.md` §„W `.astro` nie planuj top-level `return`"
- Wiążąca lekcja: `context/foundation/lessons.md` §„Wyspa bez `client:*` i flaga trybu odczytu to
  jedna zmiana, nie dwie" (stąd „cała Faza 3 to jeden commit")
- Wzorzec trasy: `src/pages/api/teams/[id].ts:33-100`
- Wzorzec repo: `src/lib/team-repo.ts:117-141`
- Wzorzec migracji: `supabase/migrations/20260906090000_teams_update_policy.sql`
- Wzorzec testu SQL: `src/lib/teams-policy-sql.test.ts:37-48`
- Wzorzec okna: `src/components/team/MemberPickerDialog.tsx:27-42`
- Ryzyko klucza omijającego RLS: `context/archive/2026-09-06-edit-saved-team/plan.md` §Progress 1.8

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków.

### Faza 1: Baza i warstwa danych

#### Automatyczne

- [x] 1.1 `npx astro sync && npm run lint` przechodzi
- [x] 1.2 `npm test` przechodzi (w tym przepisany `teams-policy-sql.test.ts`)
- [x] 1.3 `npm run build` przechodzi
- [x] 1.4 Migracja nadaje politykę `for delete` oraz `grant delete on public.teams to authenticated`
- [x] 1.5 Polityka delete nie ma `with check`
- [x] 1.6 Repo nadal nie filtruje po `user_id`
- [x] 1.7 Repo nadal nie importuje `astro:*` ani `@/lib/supabase`
- [x] 1.8 Nieaktualna granica zakresu „to S-06" zniknęła z testu SQL
- [x] 1.9 Żaden przywilej usuwania nie wyciekł poza tabelowy `delete` (brak `grant all`, brak `truncate`)
- [x] 1.10 Żadna trasa ani komponent nie woła jeszcze `deleteTeam`

#### Ręczne

- [x] 1.11 `supabase db push` stosuje migrację bez błędu
- [x] 1.12 Panel Supabase pokazuje na `public.teams` dokładnie cztery polityki
- [x] 1.13 Warunek stały przed Fazą 2: produkcyjny `SUPABASE_KEY` zaczyna się od `sb_publishable_`

### Faza 2: Trasa usuwania

#### Automatyczne

- [ ] 2.1 `npx astro sync && npm run lint` przechodzi
- [ ] 2.2 `npm test` przechodzi
- [ ] 2.3 `npm run build` przechodzi
- [ ] 2.4 Zero JSON w odpowiedziach trasy
- [ ] 2.5 Każdy `return` w trasie to `context.redirect`
- [ ] 2.6 Trasa nie zna bramki progu, składu ani `formData`
- [ ] 2.7 `reject(DELETE_FAILED_MESSAGE)` występuje dokładnie 2× (obie gałęzie odmowy, jeden tekst)
- [ ] 2.8 Cel przekierowania sukcesu to dokładnie `"/teams?deleted=1"`
- [ ] 2.9 `src/middleware.ts` nietknięty
- [ ] 2.10 Żaden komponent nie woła jeszcze trasy usuwania

#### Ręczne

- [ ] 2.11 POST na własne id → 302 na `/teams?deleted=1`, wiersz znika z listy
- [ ] 2.12 POST na id drugiego konta → 302 na `?error=`, strona docelowa to puste 404, drużyna drugiego konta nietknięta (US-04)
- [ ] 2.13 POST na id niebędące UUID → ten sam komunikat, bez 500 i bez `22P02` w logach
- [ ] 2.14 POST bez ciasteczka sesji → przekierowanie na `/auth/signin`

### Faza 3: Ekran

#### Automatyczne

- [ ] 3.1 `npx astro sync && npm run lint` przechodzi
- [ ] 3.2 `npm test` przechodzi
- [ ] 3.3 `npm run build` przechodzi
- [ ] 3.4 `alert-dialog.tsx` bez importów `from "radix-ui"` i `from "cn"`
- [ ] 3.5 `@radix-ui/react-alert-dialog` w `dependencies`
- [ ] 3.6 `package-lock.json` wolny od `radix-ui` i `cn`
- [ ] 3.7 `components.json` i `src/styles/global.css` nietknięte
- [ ] 3.8 `DeleteTeamDialog` używa natywnego formularza — bez `fetch`/`onSubmit` i bez `AlertDialogAction`
- [ ] 3.9 `TeamComposer` nie wie o usuwaniu
- [ ] 3.10 `/teams/[id].astro` ma dokładnie dwie dyrektywy `client:load`
- [ ] 3.11 `/teams/index.astro` zostaje czystym SSR (zero `client:*`)
- [ ] 3.12 `git show --stat HEAD` wymienia wszystkie sześć plików Fazy 3 razem

#### Ręczne

- [ ] 3.13 Przycisk otwiera modalne okno nazywające drużynę po nazwie-hashu
- [ ] 3.14 Escape i „Cancel" zostawiają drużynę nietkniętą (US-03)
- [ ] 3.15 Kliknięcie w tło nie zamyka okna
- [ ] 3.16 Potwierdzenie kończy się na `/teams` z banerem „Team deleted.", drużyna zniknęła
- [ ] 3.17 Usunięcie ostatniej drużyny pokazuje baner nad stanem pustym z wezwaniem do utworzenia nowej
- [ ] 3.18 Ekran 404 nie pokazuje przycisku usuwania
- [ ] 3.19 Zapis składu z S-05 nadal działa (`?saved=1`)
