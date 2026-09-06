# Plan implementacji: Cudza drużyna jest niedostępna każdą ścieżką

## Przegląd

S-07 domyka Guardrail „izolacja danych między kontami” (US-04, FR-004). Fragment jest nietypowy,
bo **mechanizm izolacji już stoi kompletny** — RLS pokrywa wszystkie cztery operacje, repo nie
rozróżnia „nie ma” od „nie twoje”, trasy API nie różnicują komunikatu. Zostają trzy rzeczy:
rozstrzygnięcie otwartego pytania roadmapy (co widzi gracz przy odgadniętym identyfikatorze),
zakotwiczenie w CI bariery odczytu, której dziś nic nie pilnuje, i dostarczenie jedynego dowodu,
jaki dla własności binarnej istnieje — przebiegu na dwóch kontach na produkcji.

## Analiza stanu obecnego

**Co już działa i nie jest przedmiotem tej zmiany:**

- **RLS pokrywa cztery operacje.** `owner can insert teams` (`with check`), `owner can read teams`
  (`using`) — `supabase/migrations/20260905185700_teams_schema.sql:35-43`; `owner can update teams`
  (`using` **i** `with check`) plus kolumnowy `grant update (composition)` —
  `20260906090000_teams_update_policy.sql:22-28`; `owner can delete teams` (`using`) plus tabelowy
  `grant delete` — `20260906120000_teams_delete_policy.sql:26-30`. `truncate` i wszystko dla `anon`
  pozostają cofnięte (`20260905185700_teams_schema.sql:45-46`).
- **Repo nie rozróżnia trzech przypadków.** `getTeamSummary`, `getTeamDetail`, `updateTeam`
  i `deleteTeam` zwracają `null` nierozróżnialnie dla nieznanego id, cudzego wiersza odciętego
  przez RLS i nie-UUID (`src/lib/team-repo.ts:106-116, 129-141, 160-176, 190-215`). `isTeamId`
  odcina nie-UUID **przed** zapytaniem, więc Postgres nie rzuca `22P02`
  (`src/lib/team-repo.ts:71-73`).
- **Repo świadomie nie filtruje po `user_id`** i zapisuje dlaczego w docstringu
  (`src/lib/team-repo.ts:11-14`): drugi warunek sugerowałby, że RLS sam nie wystarcza.
- **Trasy API nie różnicują komunikatu.** `SAVE_FAILED_MESSAGE`
  (`src/pages/api/teams/[id].ts:31-35`) i `DELETE_FAILED_MESSAGE`
  (`src/pages/api/teams/[id]/delete.ts:29-38`) są wspólne dla „nie ma czego zapisać / skasować”
  i dla awarii zapytania; gałęzie różnią się logiem, nie odpowiedzią.
- **Ochrona tras.** `PROTECTED_ROUTES = ["/dashboard", "/teams", "/api/teams"]`
  (`src/middleware.ts:4`), plus obrona w głąb `if (!context.locals.user)` w każdym handlerze API.
- **Ochrona przed obcym POST-em.** Ciasteczka `@supabase/ssr` mają `sameSite: "lax"`, a Astro ma
  domyślne `security.checkOrigin: true` — udokumentowane w
  `src/pages/api/teams/[id]/delete.ts:17-23`.

**Czego brakuje:**

1. **Puste 404.** `src/pages/teams/[id].astro:84` i `src/pages/teams/[id]/embark.astro:41`
   renderują `notFound ? null : …`. Gracz dostaje białą stronę bez nagłówka i bez jednego linku.
   Roadmapa S-07 zobowiązuje wprost: „rozstrzyga docelowo (404 vs redirect na listę)
   **i dokłada nawigację**”.
2. **Bariera odczytu nie ma kotwicy w CI.** `src/lib/teams-policy-sql.test.ts` asercjonuje politykę
   `update` (linie 57-72) i `delete` (78-95) oraz strażników negatywnych na grantach (74-76, 97-118),
   ale **nie dotyka** `owner can read teams`, `owner can insert teams` ani
   `enable row level security`. Tymczasem to na polityce `select` stoją `listTeams` i `getTeamDetail`,
   a `enable row level security` jest pojedynczym punktem, którego zdjęcie rozbroiłoby wszystkie
   cztery polityki naraz — bez błędu lintera, typów i bez zmiany w kodzie aplikacji.
3. **Follow-up F2.** `src/pages/api/teams/[id].ts:37` — `const id = context.params.id ?? ""` trafia
   surowo do `reject()`, a stamtąd do nagłówka `Location`. Astro dekoduje ścieżkę przed dopasowaniem
   trasy, więc `POST /api/teams/%0A` daje `params.id === "\n"`; nowa linia w `Location` wywraca
   `new Response` — nieprzechwycony throw to 500 w Workerze. Bliźniacza trasa
   `src/pages/api/teams/[id]/delete.ts:41` ma już poprawkę.
4. **Dowodu nie ma.** AGENTS.md wymusza czyste testy — nic pod testem nie może importować `astro:*`
   ani `@/lib/supabase` — więc izolacji cross-account **nie da się** zautomatyzować w Vitest.
   Automatyzowalna jest wyłącznie treść migracji. Dowodem musi być przebieg ręczny na dwóch kontach.

## Pożądany stan końcowy

Gracz, który wpisze w adres cudzy lub zmyślony identyfikator drużyny, dostaje odpowiedź 404
z czytelnym ekranem: „This team does not exist, or it is not yours.” plus linki do własnej listy
i dashboardu. Odpowiedź jest **identyczna** na `/teams/[id]` i `/teams/[id]/embark` — ta sama
treść, ten sam tytuł, ta sama nawigacja — więc nie da się z niej wywnioskować, czy wiersz istnieje.

W CI każda z czterech operacji CRUD ma zakotwiczoną własną barierę SQL, a wyłączenie RLS lub
skasowanie polityki w przyszłej migracji zapala czerwony test.

Na produkcji, na dwóch kontach, przebieg macierzy kończy się zerem: konto B nie odczytało, nie
zmieniło i nie skasowało żadnej drużyny konta A — ani przez interfejs, ani przez spreparowane
żądanie — a konto A po całym przebiegu ma swoją drużynę w niezmienionym stanie.

Macierz obejmuje **trzy** operacje razy dwie ścieżki, nie cztery. Bariera `insert`
(`with check (user_id = (select auth.uid()))`) jest z aplikacji **nieosiągalna do naruszenia**:
`createTeam` przyjmuje `userId` jako argument, a `src/pages/api/teams/index.ts:71` podaje
`user.id` z sesji — formularz niesie wyłącznie `composition`, więc żadne spreparowane żądanie nie
podstawi cudzego `user_id`. Tę barierę dowodzi wyłącznie test SQL z Fazy 2; Faza 3 sprawdza przy
niej tylko drugą stronę odczytu (krok 3.9). Nazwanie tego wprost jest częścią stanu końcowego:
dowód, który obiecuje więcej, niż pokrywa, jest gorszy niż dowód mniejszy i uczciwy.

### Kluczowe odkrycia:

- **Izolacja nie wymaga nowego kodu ochronnego.** Wszystkie cztery polityki RLS istnieją
  (`supabase/migrations/20260905185700_teams_schema.sql:35-43`,
  `20260906090000_teams_update_policy.sql:24-28`, `20260906120000_teams_delete_policy.sql:26-30`).
- **Zakaz top-level `return` w `.astro`** (`context/foundation/lessons.md`, lekcja z S-03, wymienia
  S-07 imiennie): typowana reguła `@typescript-eslint/no-misused-promises` crashuje i wywraca
  `npm run lint`. Ta lekcja przesądza mechanizm — 404 zostaje na `Astro.response.status`,
  a nie staje się `return Astro.redirect(...)`.
- **Wzorzec testu na SQL już istnieje** — `src/lib/teams-policy-sql.test.ts` z helperami
  `latestMigration(suffix)` i `allMigrationsWithoutComments()`. Drugi z nich **strzyże komentarze
  przed dopasowaniem**, bo migracje opisują w prozie przywileje, których nie nadają.
- **Kryteria grepowe kotwiczyć na składni** (`context/foundation/lessons.md`, lekcja z S-06):
  trzy kryteria poprzedniego planu trafiły w cudze komentarze i były odhaczone mimo czerwonej komendy.
- **Klucz `sb_publishable_` był weryfikowany 2026-09-06** przy S-05 (`plan.md` §Progress 1.8),
  z adnotacją „warunek stały, nie jednorazowy”. Przebieg z Fazy 3 na produkcji odtwarza tę
  weryfikację empirycznie, więc F8 nie potrzebuje osobnej pozycji.
- **Copy interfejsu jest po angielsku** w całym `src/pages/` i `src/components/` — nowy ekran
  musi trzymać tę konwencję.

## Czego NIE robimy

- **Żadnego redirectu na listę.** Rozstrzygnięcie roadmapy zapada na „404 z pełną stroną”; opcja
  `?missing=1` na `/teams` odrzucona, żeby nie dokładać czwartego parametru stanu i nie wprowadzać
  ręcznego składania nagłówka `Location` we frontmatterze `.astro`.
- **Żadnego `.eq("user_id", …)` w `src/lib/team-repo.ts`.** RLS zostaje jedyną barierą — decyzja
  podtrzymana świadomie. Filtr w kodzie maskowałby awarię polityki i uczyniłby Fazę 3
  nierozstrzygającą: zielony przebieg nie odróżniłby działającego RLS od działającego filtru.
- **Żadnej nowej migracji.** Polityki są komplet od S-06; ten fragment dokłada wyłącznie asercje
  nad ich treścią. `supabase/` musi wyjść z diffu nietknięty, `supabase db push` nie jest wołane.
- **Żadnej zmiany w `PROTECTED_ROUTES`.** Prefiks `/teams` dopasowuje też `/teamsfoo`, ale to
  **nad**ochrona (trasa nie istnieje, a niezalogowany i tak trafia na logowanie) — nie luka.
- **Żadnego audytu kompletności tras.** Przy dzisiejszych pięciu trasach dotykających `teams` to
  ceremonia, a wynik zestarzałby się przy pierwszej nowej trasie. Odrzucone w triażu zakresu.
- **Żadnej osobnej pozycji na F8** (potwierdzenie klucza w dashboardzie Supabase) — pochłania ją
  przebieg Fazy 3 na produkcji.
- **Żadnego przepisania `teams-policy-sql.test.ts` na macierz generatywną** — refaktor działającego
  testu spoza umowy tego fragmentu; dzisiejsze komentarze niosą uzasadnienia, które `it.each` by zgubił.
- **Żadnych testów komponentów React ani testów E2E.** Strategia testowania i bramki jakości
  wchodzą w Module 3.

## Podejście do implementacji

Trzy fazy, ułożone tak, żeby dowód powstawał na kodzie już wdrożonym.

**Faza 1** zmienia to, co Faza 3 obserwuje, więc musi być pierwsza: ekran „nie znaleziono” trafia do
jednego komponentu `.astro`, który sam renderuje `Layout`. To jest odpowiedź na klasę awarii
z lekcji o „dwóch przełącznikach w dwóch warstwach”: treść komunikatu jest jedyną rzeczą, która
**nie może** się rozjechać między trasami, bo różnica ujawniałaby istnienie rekordu — więc dostaje
dokładnie jedno źródło. Ta sama faza domyka F2, żeby bliźniacze trasy zapisu nie zostały rozjechane.

**Faza 2** jest niezależna od Fazy 1, ale idzie przed wdrożeniem, żeby CI był zielony w chwili deployu.
Dokłada asercje na barierze odczytu i dwóch strażników negatywnych. Zamyka je kontrola mutacyjna:
test, który nie czerwienieje po rozbrojeniu migracji, nie jest kotwicą, tylko dekoracją.

**Faza 3** to jedyny prawdziwy dowód. Biegnie na produkcji, bo tylko tam działa produkcyjny
`SUPABASE_KEY` i produkcyjna baza — a klucz omijający RLS przewróciłby izolację cicho i wyłącznie
cross-account.

## Krytyczne szczegóły implementacji

**Sekwencjonowanie i pułapka Fazy 3 — `checkOrigin` daje fałszywie zielony wynik.** Astro ma
domyślne `security.checkOrigin: true`, które zwraca **403 dla każdego nie-GET z formularzowym
`Content-Type` i obcym `Origin`**. Spreparowany POST wysłany ze `file://`, z curla bez nagłówków
albo z innej domeny zostanie odrzucony **przez CSRF, zanim dotknie RLS** — i przebieg wyglądałby
na zielony, nie dowodząc niczego o izolacji. Żądania z kroków 3.6 i 3.7 muszą iść z **origin samej
aplikacji** (konsola devtools otwarta na stronie aplikacji, sesja konta B, `fetch` z
`credentials: "include"` i formularzowym `Content-Type`), żeby CSRF przepuścił je do handlera
i barierą, która je zatrzyma, było RLS. Każdy krok macierzy musi odnotować **kod odpowiedzi**:
403 znaczy „nie sprawdzono tego, co chciano sprawdzić”, i wymaga powtórzenia.

**Druga, symetryczna pułapka Fazy 3 — bramka progu też stoi przed RLS.** W
`src/pages/api/teams/[id].ts` przed `updateTeam` jest jeszcze `gateTeamSubmission` (linie 77-81).
Spreparowany POST z ładunkiem, który nie parsuje się albo nie domyka progu, kończy się
przekierowaniem z `?error=Invalid team payload` albo `?error=Every competency needs at least
2 points…` — i **RLS nie jest wołane w ogóle**. Skutek jest nie do odróżnienia od zielonego:
drużyna A nietknięta, odpowiedź nie jest 403, więc strażnik z akapitu wyżej się nie zapala.
Rozróżnia je komunikat: odcięcie przez RLS daje `?error=Could not save the team`
(`SAVE_FAILED_MESSAGE`, `src/pages/api/teams/[id].ts:31`) i log `No team row to update` (linia 91)
— nic innego nie daje tego tekstu. **Ładunek kroku 3.7 musi więc być poprawnym składem
domykającym próg**, skopiowanym z własnej drużyny konta B.

**Gdzie odczytać ten komunikat.** Po przekierowaniu strona `/teams/<id_A>` renderuje ekran 404
z Fazy 1, a `?error=` **nie jest tam wyświetlane** — slot błędu żyje wyłącznie w gałęzi sukcesu
(`src/pages/teams/[id].astro:114`). Komunikat trzeba odczytać z nagłówka `Location` odpowiedzi 302
w zakładce Network devtools, a nie z ekranu. To samo dotyczy kroku 3.8.

**Cykl życia Fazy 3 — potwierdzanie adresu jest na produkcji WŁĄCZONE** (`prd.md` FR-001,
`AGENTS.md`). Oba konta wymagają klikniętego linku z poczty, zanim cokolwiek zapiszą; kliknięcie
linku **nie loguje**, więc po nim trzeba przejść przez ekran logowania. Warto założyć oba konta
i potwierdzić oba adresy, zanim zacznie się przebieg macierzy.

**Kolejność w `.astro`.** `Astro.response.status = 404` musi zostać ustawione we frontmatterze,
zanim wykona się szablon — tak jak dziś (`[id].astro:80-82`, `embark.astro:36-38`). Zmienia się
**wyłącznie** ciało w gałęzi `notFound`; sama flaga, jej wyliczenie i status zostają nietknięte.

---

## Faza 1: Ekran „nie znaleziono” i domknięcie F2

### Przegląd

Puste 404 zamienia się w stronę z komunikatem i nawigacją, identyczną na obu trasach dynamicznych.
Ta sama faza domyka follow-up F2 z przeglądu S-06, żeby bliźniacze trasy zapisu nie zostały
rozjechane w traktowaniu `params.id`.

### Wymagane zmiany:

#### 1. Wspólny ekran „nie znaleziono”

**Plik**: `src/components/team/TeamNotFound.astro` (nowy)

**Cel**: Dać obu trasom dynamicznym jedną, wspólną odpowiedź na `notFound`, żeby treść, tytuł
i nawigacja nie mogły się między nimi rozjechać. Rozjazd jest tu awarią cichą i jednocześnie
wyciekiem: różnica między odpowiedziami dwóch tras na to samo cudze id ujawniałaby, że trasy
wiedzą o wierszu różne rzeczy.

**Umowa**: Komponent bez propsów. Renderuje **własny** `Layout` (import z `@/layouts/Layout.astro`)
ze stałym tytułem, więc strona wywołująca podaje wyłącznie `<TeamNotFound />` i nie ma czym się
pomylić — to jest powód, dla którego `Layout` idzie do środka, a nie zostaje na zewnątrz.
Treść: nagłówek plus zdanie **`This team does not exist, or it is not yours.`** (forma łączna —
nazywa regułę izolacji, nie ujawniając, który z trzech przypadków zaszedł: nieznane id, cudzy
wiersz, skasowana własna drużyna). Dwa linki nawigacyjne: `/teams` i `/dashboard`. Układ i klasy
Tailwind wzorowane na istniejącej karcie błędu z `src/pages/teams/[id]/embark.astro:71-82`.
Copy po angielsku, zgodnie z resztą interfejsu.

#### 2. Widok szczegółów drużyny

**Plik**: `src/pages/teams/[id].astro`

**Cel**: Zastąpić pustą gałąź `notFound` wspólnym ekranem. Wyliczenie `notFound` (linia 62),
ustawienie statusu (80-82) oraz wszystkie pozostałe gałęzie — `teamFailed`, `inconsistent`, sukces —
zostają bez zmian.

**Umowa**: Import `TeamNotFound` i podmiana `notFound ? null : (…)` na `notFound ? <TeamNotFound />
: (…)`. Komentarz w nagłówku frontmattera (linie 12-14), który dziś zapowiada gołe 404, ma zostać
uaktualniony: mechanizm (`Astro.response.status`, nigdy top-level `return`) obowiązuje dalej,
zmienia się tylko ciało odpowiedzi.

#### 3. Ekran potwierdzenia zapisu

**Plik**: `src/pages/teams/[id]/embark.astro`

**Cel**: Ta sama podmiana co wyżej, żeby obie trasy odpowiadały identycznie.

**Umowa**: Import `TeamNotFound`, podmiana `notFound ? null : (…)`. Komentarz w linii 23
(„S-07 rozstrzyga docelowo (404 vs redirect)”) ma zostać zastąpiony zapisem rozstrzygnięcia:
404 z pełną stroną, wspólny komponent. Gałąź `failed` („Team is unavailable right now”) zostaje
nietknięta — awaria zapytania to inny stan niż brak wiersza i ma prawo wyglądać inaczej,
bo atakujący nie potrafi jej wywołać.

#### 4. Follow-up F2 — kodowanie `params.id` w trasie zapisu

**Plik**: `src/pages/api/teams/[id].ts`

**Cel**: Usunąć ścieżkę do 500 w Workerze: surowe `params.id` trafia do nagłówka `Location`, więc
`params.id === "\n"` (osiągalne przez `POST /api/teams/%0A`) wywraca `new Response`.

**Umowa**: Deklaracja `id` (linia 37) przyjmuje kształt bliźniaczy do
`src/pages/api/teams/[id]/delete.ts:41` — `encodeURIComponent(context.params.id ?? "")`. Wywołanie
`updateTeam(supabase, { id: context.params.id, … })` (linia 82) zostaje na **surowej** wartości:
formatu pilnuje `isTeamId`, a zakodowana wersja służy wyłącznie do budowy adresu i logów.
Komentarz wyjaśniający ma zostać przeniesiony z `delete.ts:38-41`, żeby obie trasy niosły to samo
uzasadnienie.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Testy przechodzą: `npm test`
- Typy i lint przechodzą: `npx astro sync && npm run lint`
- Build przechodzi: `npm run build`
- Obie strony importują wspólny komponent — dokładnie 2 pliki:
  `test $(grep -rlE '^import TeamNotFound from "@/components/team/TeamNotFound\.astro";$' src/pages/ | wc -l) -eq 2`
- Żadna z obu stron nie zgubiła statusu 404 — dokładnie 2 pliki:
  `test $(grep -rlF 'Astro.response.status = 404' src/pages/teams/ | wc -l) -eq 2`
- Treść komunikatu ma dokładnie jedno źródło w `src/`:
  `test $(grep -rlF 'or it is not yours' src/ | wc -l) -eq 1`
- Zero top-level `return` w trzech dotkniętych plikach `.astro` (lekcja z S-03; kotwica na
  początku wiersza, nie na słowie):
  `! grep -nE '^return\b' 'src/pages/teams/[id].astro' 'src/pages/teams/[id]/embark.astro' src/components/team/TeamNotFound.astro`
- Obie trasy zapisu deklarują `id` identycznie — dokładnie 2 trafienia:
  `test $(grep -rhE '^\s*const id = encodeURIComponent\(context\.params\.id \?\? ""\);$' 'src/pages/api/teams/[id].ts' 'src/pages/api/teams/[id]/delete.ts' | wc -l) -eq 2`
- `supabase/` nietknięte: `test -z "$(git status --porcelain supabase/)"`

#### Ręczna weryfikacja:

- `/teams/<losowy-uuid>` pokazuje ekran z komunikatem i oboma linkami, a nie białą stronę
- `/teams/<losowy-uuid>/embark` pokazuje **ten sam** ekran — identyczny tytuł zakładki, identyczna treść
- `/teams/nie-uuid` (nie-UUID w adresie) zachowuje się tak samo, bez błędu Postgresa
- Własna drużyna renderuje się bez zmian: skład, wykres, przycisk zapisu, przycisk usuwania
- Awaria odczytu (`teamFailed`) dalej pokazuje „Team is unavailable right now”, nie nowy ekran

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych
weryfikacji, zatrzymaj się tutaj w celu ręcznego potwierdzenia przez człowieka, zanim przejdziesz
do następnej fazy.

---

## Faza 2: Kotwice SQL dla bariery odczytu

### Przegląd

`teams-policy-sql.test.ts` pilnuje dziś zapisu i usuwania, ale nie odczytu — czyli nie rdzenia
US-04. Faza domyka macierz do czterech operacji i dokłada dwóch strażników negatywnych.
Bez zmian w `supabase/`.

### Wymagane zmiany:

#### 1. Asercje na barierze odczytu i tworzenia

**Plik**: `src/lib/teams-policy-sql.test.ts`

**Cel**: Zakotwiczyć w CI polityki, na których stoi izolacja odczytu (`listTeams`, `getTeamDetail`,
`getTeamSummary`) i tworzenia — dziś jedyne bariery bez testu. Docstring pliku (linie 8-14) opisuje
zakres jako „S-05 i S-06”; ma zostać rozszerzony o S-07 i o powód: repo celowo nie filtruje po
`user_id` (`src/lib/team-repo.ts:11-14`), więc polityka `select` jest jedyną barierą odczytu.

**Umowa**: Trzy nowe przypadki nad `latestMigration("_teams_schema.sql")`:
polityka `owner can read teams` niesie `for select to authenticated` oraz
`using (user_id = (select auth.uid()))`; polityka `owner can insert teams` niesie
`with check (user_id = (select auth.uid()))`; migracja włącza
`alter table public.teams enable row level security`. Sufiks `_teams_schema.sql` nie koliduje
z `_character_pool_schema.sql`.

#### 2. Strażnicy negatywni na rozbrojeniu RLS

**Plik**: `src/lib/teams-policy-sql.test.ts`

**Cel**: Domknąć klasę „przyszła migracja rozbraja izolację po cichu”. Dzisiejsze strażniki chronią
przed **dodaniem** przywileju (`grant all`, `truncate`, cokolwiek dla `anon`); brakuje ochrony przed
**odjęciem** bariery. Wyłączenie RLS albo skasowanie polityki nie zmienia ani jednej linii kodu
aplikacji, nie rusza typów i nie zapala lintera — a przewraca Guardrail w całości.

**Umowa**: Dwa przypadki nad `allMigrationsWithoutComments()` — helper strzyże komentarze, co jest
tu konieczne, bo migracje opisują w prozie dokładnie te konstrukcje, których strażnicy pilnują.
Wzorce kotwiczone na składni, nie na słowie (lekcja z S-06): żadna migracja nie zawiera
`alter table … public.teams … disable row level security` ani `drop policy … on … public.teams`.

Umowa strażnika `drop policy` musi nazwać **furtkę**, bo inaczej jest sprzeczna z §Uwagi dotyczące
migracji („odpowiedzią na rozjazd jest nowa migracja"): korekta istniejącej polityki idzie przez
`alter policy` — ta forma strażnika nie zapala. `drop policy` zostaje zarezerwowane na świadome
zdjęcie bariery, które **wymaga zdjęcia tego strażnika w tej samej zmianie**, z uzasadnieniem
w komentarzu testu. Ta furtka ma być zapisana w komentarzu przy asercji, nie tylko tutaj: bez niej
pierwsza uzasadniona korekta polityki zobaczy czerwony test i osłabi strażnika pod presją.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Wszystkie testy przechodzą, w tym pięć nowych: `npm test`
- Plik testu ma pięć nowych przypadków (11 zamiast 6):
  `test $(grep -cE '^  it\(' src/lib/teams-policy-sql.test.ts) -eq 11`
- Typy i lint przechodzą: `npx astro sync && npm run lint`
- Zero zmian w `supabase/`: `test -z "$(git status --porcelain supabase/)"`
- Test nie wciąga stosu Astro ani Supabase (twarda reguła czystości testów):
  `! grep -nE '^import .* from "(astro|@/lib/supabase)' src/lib/teams-policy-sql.test.ts`

#### Ręczna weryfikacja:

- **Kontrola mutacyjna** — **usunąć** lokalnie linię `alter table public.teams enable row level
  security;` z `20260905185700_teams_schema.sql`, uruchomić `npm test`, potwierdzić **czerwony**
  wynik, cofnąć zmianę (`git checkout -- supabase/`). **Usunięcie, nie zakomentowanie**: asercje
  pozytywne biegną po `latestMigration()`, które zwraca surowy tekst pliku — komentarze strzyże
  wyłącznie `allMigrationsWithoutComments()`, używany przez strażników negatywnych. Zakomentowana
  linia dalej trafia w `toContain(...)` i test zostałby zielony, a kontrola dałaby fałszywy werdykt
  „wzorzec do poprawy" na poprawnym teście (lekcja z S-06 odwrócona). Zakomentowanie zastosowanej
  migracji i tak nie odzwierciedla zagrożenia: dla bazy jest no-op — realną klasą jest przyszła
  migracja z `disable row level security`, pilnowana przez strażnika negatywnego. Test, który po
  usunięciu linii zostaje zielony, nie jest kotwicą i wymaga poprawienia wzorca.
- Ta sama kontrola dla polityki `owner can read teams` — usunąć ją lokalnie, potwierdzić czerwień, cofnąć
- `git status` po obu kontrolach jest czysty w `supabase/`

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie kontroli
mutacyjnej. To ona odróżnia kotwicę od dekoracji i jest jedynym powodem, dla którego ta faza
w ogóle istnieje.

---

## Faza 3: Dowód dwukontowy na produkcji

### Przegląd

Jedyny dowód, jaki dla własności binarnej istnieje. Biegnie na wdrożonej aplikacji, bo tylko tam
działa produkcyjny `SUPABASE_KEY` i produkcyjna baza — a klucz `sb_secret_` omijałby RLS w całości
i przewracał izolację cicho, wyłącznie cross-account, bez śladu w kodzie. Zielony przebieg tej fazy
**pochłania follow-up F8** z przeglądu S-04.

Faza jest w całości ręczna. Nie ma tu zmian w repozytorium poza wdrożeniem tego, co powstało
w Fazach 1 i 2.

### Wymagane zmiany:

#### 1. Wdrożenie

**Plik**: — (operacja, nie edycja)

**Cel**: Postawić na produkcji kod z Faz 1 i 2, żeby przebieg macierzy obserwował stan docelowy.

**Umowa**: `npm run build`, następnie `npx wrangler deploy` (**nie** `wrangler pages deploy` —
adapter v13+ nie wspiera Pages). `supabase db push` **nie jest wołane**: ten fragment nie dokłada
migracji. `supabase config push` nie jest wołane nigdy.

#### 2. Protokół macierzy

**Plik**: `context/changes/cross-account-team-isolation/plan.md` §Progress (kroki 3.3-3.10)

**Cel**: Zapisać wynik przebiegu tam, gdzie działa cały łańcuch — `/10x-implement` odhacza,
`/10x-impl-review` weryfikuje.

**Umowa**: Każdy krok macierzy odnotowuje przy odhaczeniu **kod odpowiedzi HTTP**, a kroki 3.7
i 3.8 dodatkowo **komunikat z nagłówka `Location`**. To są dwa zabezpieczenia przed fałszywie
zielonym wynikiem, oba opisane w §Krytyczne szczegóły implementacji: `403` z `checkOrigin` znaczy,
że żądanie nie dotarło do RLS; komunikat inny niż `Could not save the team` /
`Could not delete the team` znaczy, że zatrzymała je bramka stojąca przed RLS. Oba wymagają
powtórzenia kroku, nie odhaczenia.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- CI na `main` zielone przed wdrożeniem: `npx astro sync && npm run lint && npm test && npm run build`

#### Ręczna weryfikacja:

- Wdrożenie zakończone sukcesem (`npx wrangler deploy`), aplikacja odpowiada pod adresem produkcyjnym
- Konta A i B założone, oba adresy potwierdzone linkiem z poczty, oba mają po jednej zapisanej drużynie
- **READ / interfejs**: konto B na `/teams` widzi wyłącznie własną drużynę — drużyny A nie ma na liście
- **READ / adres**: konto B na `/teams/<id_A>` dostaje **404** i ekran „This team does not exist,
  or it is not yours.”; żadna nazwa-hash ani skład konta A nie pojawia się w źródle odpowiedzi
- **READ / adres**: konto B na `/teams/<id_A>/embark` dostaje **404** i identyczny ekran
- **UPDATE**: spreparowany `POST /api/teams/<id_A>` ze składem **domykającym próg**, wysłany
  z origin aplikacji na sesji konta B, **nie zmienia** drużyny A — konto A po odświeżeniu widzi
  skład sprzed przebiegu. Przekierowanie 302 niesie `error=Could not save the team` (odczyt
  z nagłówka `Location` w Network). Odpowiedź 403 = zadziałał CSRF, nie RLS; inny komunikat błędu
  = zadziałała bramka progu, nie RLS — oba znaczą „powtórz krok”
- **DELETE**: spreparowany `POST /api/teams/<id_A>/delete` z origin aplikacji na sesji konta B
  **nie kasuje** drużyny A — konto A dalej widzi ją na liście. Przekierowanie 302 niesie
  `error=Could not delete the team`; odpowiedź 403 = zadziałał CSRF, nie RLS (powtórz krok).
  Ta trasa nie czyta ciała żądania, więc bramki progu tu nie ma
- **ODCZYT, druga strona**: drużyna zapisana przez konto B nie pojawia się na liście konta A ani
  przed, ani po odświeżeniu. To jest asercja na polityce `select` — krok 3.4 odwrócony — a nie
  test bariery `insert`; tej ostatniej nie da się z aplikacji naruszyć (patrz §Pożądany stan
  końcowy), więc dowodzi jej test SQL z Fazy 2, nie ten krok
- **Regresja ścieżki własnej**: konto A dalej otwiera, edytuje i usuwa własną drużynę bez zmian
  w zachowaniu — izolacja nie zablokowała właściciela
- **F8 pochłonięty**: wszystkie powyższe kroki zielone **na produkcji** dowodzą, że produkcyjny
  `SUPABASE_KEY` nie omija RLS, czyli nie jest kluczem `sb_secret_`. Odnotuj to wprost przy
  odhaczeniu — to jest zamknięcie follow-upu z przeglądu S-04

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/teams-policy-sql.test.ts` rośnie o pięć przypadków: trzy pozytywne (polityka `select`,
  polityka `insert`, `enable row level security`) i dwa negatywne (`disable row level security`,
  `drop policy` na `public.teams`).
- Przypadek brzegowy pokryty przez helper `allMigrationsWithoutComments()`: migracje opisują
  w prozie konstrukcje, których strażnicy pilnują, więc bez strzyżenia komentarzy asercje szłyby
  na czerwono na zdaniach robiących dokładnie to, czego strzegą.

### Czego zautomatyzować się NIE da:

Izolacja cross-account wymaga dwóch uwierzytelnionych sesji i działającej bazy. AGENTS.md zabrania
testom bootstrapować Astro i Supabase — nic pod testem nie może importować `astro:*` ani
`@/lib/supabase` — więc Vitest może dowieść wyłącznie **treści migracji**, nigdy **zachowania bazy**.
To jest powód, dla którego Faza 3 istnieje i dlaczego jej kroki są ręczne. Zielony `npm test` nie
jest dowodem US-04 i nie wolno go za taki uznać.

### Kroki testowania ręcznego:

1. Otwórz `/teams/<losowy-uuid>` jako zalogowany gracz — oczekiwany 404 z ekranem i dwoma linkami.
2. Otwórz `/teams/<ten-sam-uuid>/embark` — oczekiwany identyczny ekran i identyczny tytuł zakładki.
3. Otwórz `/teams/not-a-uuid` — to samo, bez błędu Postgresa `22P02` w logach.
4. **Usuń** linię `enable row level security` z migracji schematu (nie komentuj — patrz Faza 2),
   uruchom `npm test`, potwierdź czerwień, cofnij (`git checkout -- supabase/`).
5. Wdróż (`npm run build && npx wrangler deploy`).
6. Załóż konta A i B, potwierdź oba adresy, zapisz po jednej drużynie na każdym.
7. Przejdź macierz z Fazy 3, notując kod odpowiedzi przy każdym kroku, a przy 3.7 i 3.8 także
   komunikat z nagłówka `Location`; każde `403` powtórz z origin aplikacji, a każdy komunikat inny
   niż `Could not save/delete the team` powtórz z poprawnym ładunkiem.
8. Zamknij przebieg sprawdzeniem regresji ścieżki własnej na koncie A.

## Uwagi dotyczące wydajności

Brak implikacji. Ekran 404 jest statycznym `.astro` bez wyspy i bez zapytań; nowe przypadki testowe
czytają te same pliki migracji, które test czyta już dziś. Wymaganie „poniżej 200 ms” z PRD dotyczy
reakcji wykresu na zmianę składu i ten fragment go nie dotyka.

## Uwagi dotyczące migracji

Brak migracji bazy. Polityki RLS są kompletne od S-06 (`20260906120000_teams_delete_policy.sql`),
a ten fragment dokłada wyłącznie asercje nad ich treścią. Migracja raz zastosowana na produkcji
jest niezmienna: jeśli Faza 2 wykaże rozjazd między oczekiwaniem a treścią migracji, odpowiedzią
jest **nowa** migracja w osobnej zmianie, nigdy nadpisanie istniejącej. `supabase config push`
nie jest wołane nigdy — wysłałoby localhostowe `site_url` na produkcję.

## Referencje

- Mapa drogowa: `context/foundation/roadmap.md` §S-07 (linie 300-320) i §W skrócie (wiersz S-07)
- PRD: `context/foundation/prd.md` §US-04, FR-004, Guardrails, Non-Functional Requirements
- Lekcje wiążące: `context/foundation/lessons.md` §„W `.astro` nie planuj top-level `return`”
  (wymienia S-07 imiennie), §„Kryteria grepowe kotwicz na składni”
- Follow-up F2: `context/archive/2026-09-06-delete-team-confirmed/follow-ups/review-fixes.md`
- Follow-up F8: `context/archive/2026-09-06-own-teams-list-and-detail/follow-ups/review-fixes.md`
- Weryfikacja klucza z S-05: `context/archive/2026-09-06-edit-saved-team/plan.md` §Progress 1.8
- Wzorzec testu na SQL: `src/lib/teams-policy-sql.test.ts`, `src/lib/domain/character-pool-sql.test.ts`
- Wzorzec karty błędu: `src/pages/teams/[id]/embark.astro:71-82`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Ekran „nie znaleziono” i domknięcie F2

#### Automatyczne

- [x] 1.1 Testy przechodzą (`npm test`)
- [x] 1.2 Typy i lint przechodzą (`npx astro sync && npm run lint`)
- [x] 1.3 Build przechodzi (`npm run build`)
- [x] 1.4 Dokładnie 2 strony importują `TeamNotFound.astro`
- [x] 1.5 Dokładnie 2 strony ustawiają `Astro.response.status = 404`
- [x] 1.6 Treść komunikatu ma jedno źródło w `src/`
- [x] 1.7 Zero top-level `return` w trzech dotkniętych plikach `.astro`
- [x] 1.8 Obie trasy zapisu deklarują `id` przez `encodeURIComponent` (2 trafienia)
- [x] 1.9 `supabase/` nietknięte

#### Ręczne

- [x] 1.10 `/teams/<losowy-uuid>` pokazuje ekran z komunikatem i oboma linkami
- [x] 1.11 `/teams/<losowy-uuid>/embark` pokazuje identyczny ekran i identyczny tytuł zakładki
- [x] 1.12 Nie-UUID w adresie zachowuje się tak samo, bez błędu Postgresa
- [x] 1.13 Własna drużyna renderuje się bez zmian (skład, wykres, zapis, usuwanie)
- [x] 1.14 Gałąź awarii odczytu dalej pokazuje „Team is unavailable right now”

### Faza 2: Kotwice SQL dla bariery odczytu

#### Automatyczne

- [ ] 2.1 Wszystkie testy przechodzą, w tym pięć nowych (`npm test`)
- [ ] 2.2 Plik testu ma 11 przypadków `it(`
- [ ] 2.3 Typy i lint przechodzą (`npx astro sync && npm run lint`)
- [ ] 2.4 Zero zmian w `supabase/`
- [ ] 2.5 Test nie importuje `astro:*` ani `@/lib/supabase`

#### Ręczne

- [ ] 2.6 Kontrola mutacyjna: usunięcie linii `enable row level security` daje czerwony `npm test`
- [ ] 2.7 Kontrola mutacyjna: usunięcie polityki `owner can read teams` daje czerwony `npm test`
- [ ] 2.8 `git status` czysty w `supabase/` po obu kontrolach

### Faza 3: Dowód dwukontowy na produkcji

#### Automatyczne

- [ ] 3.1 CI zielone przed wdrożeniem (`astro sync && lint && test && build`)

#### Ręczne

- [ ] 3.2 Wdrożenie (`npx wrangler deploy`) zakończone, aplikacja odpowiada
- [ ] 3.3 Konta A i B założone i potwierdzone, każde z zapisaną drużyną
- [ ] 3.4 READ/interfejs: konto B na `/teams` nie widzi drużyny konta A
- [ ] 3.5 READ/adres: `/teams/<id_A>` na koncie B → 404 + ekran, zero danych konta A w źródle
- [ ] 3.6 READ/adres: `/teams/<id_A>/embark` na koncie B → 404 + identyczny ekran
- [ ] 3.7 UPDATE: spreparowany POST z origin aplikacji nie zmienia drużyny A (302 z `error=Could not save the team` — nie 403, nie komunikat progu)
- [ ] 3.8 DELETE: spreparowany POST z origin aplikacji nie kasuje drużyny A (302 z `error=Could not delete the team`, nie 403)
- [ ] 3.9 Odczyt (druga strona): drużyna konta B nie pojawia się na liście konta A
- [ ] 3.10 Regresja: konto A dalej otwiera, edytuje i usuwa własną drużynę
- [ ] 3.11 F8 zamknięty: zielony przebieg na produkcji dowodzi, że klucz nie omija RLS
