# Plan implementacji: edycja składu zapisanej drużyny (S-05)

## Przegląd

Gracz otwiera zapisaną drużynę pod `/teams/[id]`, wymienia członka albo zmienia jego perki i zapisuje
zmiany — pod **dokładnie tym samym progiem**, który przepuścił pierwszy zapis, i bez możliwości
tknięcia nazwy-hasha. Domyka **U** z pętli CRUD (US-02, FR-009, FR-018, FR-011).

Fragment jest w dużej mierze **odblokowaniem** kodu, który S-04 zostawił świadomie martwy:
`/teams/[id]` renderuje dziś `TeamComposer` w trybie odczytu, bez `client:load`, z notą „Nota dla
S-05". Ten plan zdejmuje tryb odczytu w całości, dokłada brakującą politykę `update` w bazie i nową
trasę zapisu.

## Analiza stanu obecnego

**Co już jest i nadaje się do ponownego użycia:**

- `gateTeamSubmission` (`src/lib/team-submission.ts:92`) — parser + `evaluateTeam(...).isValid`.
  Nie wie, czy zapisuje nowy wiersz, czy podmienia istniejący, więc trasa edycji może zawołać ją
  bez zmian. To jest gotowa odpowiedź na ryzyko S-05 z roadmapy („fragment sprawdzający próg tylko
  przy pierwszym zapisie łamie Guardrail tylnymi drzwiami").
- `resolveSavedTeam` (`src/lib/team-view.ts:31`) — odrzuca w całości skład, którego nie da się
  złożyć z aktualną pulą. Jego docstring (linie 8–11) mówi wprost, że powstał, żeby **edycja nie
  skasowała członka bezpowrotnie**. Edycja dziedziczy tę ochronę bez zmian: gdy skład jest odrzucony,
  strona pokazuje stan awarii zamiast wyspy, więc nie ma czego zapisać.
- `POST /api/teams` (`src/pages/api/teams/index.ts`) — wzorzec trasy zapisu do skopiowania:
  natywny formularz, `?error=` zamiast JSON, każdy `throw` złapany (nieprzechwycony throw
  w Workerze to 500).
- `TeamComposer` (`src/components/team/TeamComposer.tsx:51`) — jedyny właściciel stanu `composition`;
  `initialComposition` jest **wartością początkową `useState`**, celowo bez `useEffect`, „żeby S-05,
  dodając zapis, nie odziedziczył dwóch źródeł prawdy" (docstring linie 20–24).

**Czego brakuje:**

- **Baza nie przyjmie update'u.** `supabase/migrations/20260905185700_teams_schema.sql` ma polityki
  wyłącznie `insert` i `select`, a linia 46 cofa przywilej: `revoke update, delete, truncate on
  public.teams from authenticated`. Komentarz linii 12–14 zapisuje to jako zobowiązanie: „Polityki
  update/delete dokładają S-05 i S-06 własnymi migracjami — razem z `grant update` / `grant delete`".
  Bez migracji `update` przechodzi bez błędu i podmienia **zero wierszy**.
- **Brak trasy zapisu zmian** — `POST /api/teams` zawsze robi `insert`.
- **Brak funkcji `updateTeam`** w `src/lib/team-repo.ts`.
- **`/teams/[id]` nie ma runtime'u.** `src/pages/teams/[id].astro:95-105` renderuje wyspę bez
  `client:*` — sloty nie mają akcji, dialog nie jest montowany, bramka nie jest renderowana.

**Ograniczenia, w ramach których trzeba działać:**

- `context/foundation/lessons.md` — „Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana,
  nie dwie". Para (dyrektywa hydratacji, flaga `readOnly`) musi zmienić się w **jednym commicie**;
  rozjechanie jej daje awarię cichą w obie strony, której nie łapie ani lint, ani typy, ani testy.
- `context/foundation/lessons.md` — w `.astro` żadnego top-level `return`. Nie dotyczy tras API
  pod `src/pages/api/`, gdzie `return` stoi wewnątrz funkcji handlera.
- AGENTS.md — moduły w `src/lib/` biorą klienta Supabase argumentem i **rzucają**; wywołujący łapie
  i mapuje na `?error=` albo stan strony.
- AGENTS.md — testy są czyste: nic pod testem nie może importować `astro:*` ani `@/lib/supabase`.
  Trasa API i strona `.astro` są więc poza zasięgiem Vitest **z definicji**; testowalna jest
  wyłącznie bramka, którą wołają.
- Vitest `src/**/*.test.ts` — bez `.tsx`, więc komponenty React nie są objęte testami.

## Pożądany stan końcowy

`/teams/[id]` jest jednym ekranem obsługującym oglądanie i edycję (FR-008): wyspa jest hydratowana,
sloty klikalne, a bramka pod wykresem nosi napis „Save changes" i celuje w `POST /api/teams/[id]`.
Usunięcie członka albo odznaczenie perka, które cofa którąkolwiek kompetencję poniżej dwóch punktów,
**natychmiast blokuje** przycisk zapisu — dokładnie tak jak przy tworzeniu. Po udanym zapisie gracz
wraca na tę samą stronę z paskiem potwierdzenia i widzi skład odczytany z bazy.

Nazwa-hash pozostaje niezmieniona i nieedytowalna, a jej niezmienność egzekwuje **baza**: rola
`authenticated` ma przywilej `update` wyłącznie na kolumnie `composition`.

Weryfikacja: `npm run lint`, `npm test`, `npm run build` przechodzą; ręczny scenariusz US-02 na
`npm run dev` z zastosowaną migracją.

### Kluczowe odkrycia:

- `supabase/migrations/20260905185700_teams_schema.sql:12-14, 19, 46` — brakujące polityki
  są **zapisanym zobowiązaniem**, a linia 19 dopowiada: „Nazwa-hash (FR-011): […] S-05 nie umieszcza
  jej w update".
- `src/pages/teams/[id].astro:103` — nota „**Nota dla S-05**: podłączając zapis, trzeba dopisać
  `client:load` z powrotem".
- `src/lib/team-view.ts:8-11` — ochrona przed cichym skasowaniem członka przy edycji już istnieje.
- `src/lib/team-repo.ts:4` — **jedyny** importer `toTeamComposition`, i **pozostaje jedyny po tym
  fragmencie**: trasa edycji bierze `COMPOSITION_FIELD` i `gateTeamSubmission`, nie kształt. Martwy
  punkt F7 policzony (liczba = 1, a `TeamComposition` mieszka w `@/lib/domain/types.ts:83`), więc
  refaktor jest tani — ale nie staje się tańszy przez zrobienie go teraz i nie jest potrzebny
  do stanu końcowego. Zostaje follow-upem.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` zawiera prefiks `/api/teams`, a dopasowanie idzie przez
  `startsWith`, więc `/api/teams/<uuid>` jest chronione **bez zmiany w middleware** (FR-004).
- `src/components/team/TeamComposer.tsx:96-98` — `handlers: RosterSlotHandlers | undefined` to
  nośnik trybu odczytu w slotach; po zdjęciu `readOnly` grupa jest zawsze obecna. **Ale sama
  opcjonalność `handlers?` w `RosterSlot.tsx:26-35` jest trzecim przełącznikiem trybu odczytu** —
  bez uczynienia propu wymaganym zostają dwie martwe gałęzie i docstring opisujący tryb, którego
  już nie ma.

## Czego NIE robimy

- **Edycji nazwy drużyny** — Non-Goal PRD; nazwa nie pojawia się w żadnym polu formularza ani
  w ładunku update'u.
- **Wersji roboczych** — zapis dalej istnieje wyłącznie dla składu spełniającego próg; przerwana
  edycja przepada, tak samo jak przerwane kompletowanie.
- **Obsługi równoległej edycji tej samej drużyny w dwóch kartach** — wygrywa ostatni zapis.
  Przy jednym graczu na konto i braku współdzielenia (Access Control: model płaski) blokady
  optymistyczne to reguła i komunikat błędu bez wartości przy tej skali.
- **Przycisku „Discard changes"** ani ostrzeżenia `beforeunload` — skład żyje w pamięci wyspy,
  więc każde opuszczenie strony przywraca zapisany stan.
- **Blokowania zapisu przy braku zmian** — przycisk jest aktywny także dla składu nietkniętego;
  ponowny zapis tej samej wartości jest bezpiecznym no-opem, a wykrywanie „czy coś się zmieniło"
  wprowadzałoby stan pochodny bez wartości dla gracza.
- **Usuwania drużyny** — to S-06 (`delete-team-confirmed`), osobny fragment. Ten plan nie dokłada
  polityki `delete` ani `grant delete`.
- **Rozstrzygnięcia 404 vs redirect dla cudzej drużyny** — zostaje jak w S-04 (nierozróżnialny
  `null`); docelowo rozstrzyga S-07.
- **Wydzielenia `src/lib/team-composition.ts` (follow-up F7)** — kształt składu zostaje
  w `team-submission.ts`. Trasa edycji nie importuje `toTeamComposition`, więc trzeci konsument
  nie powstaje, a liczba importerów po tym fragmencie dalej wynosi jeden. Refaktor jest równie
  tani później; wchodzi jako osobny follow-up, nie w fazie z migracją.
- **Testów komponentów React** — runner obejmuje `src/**/*.test.ts`, bez `.tsx`; dokładanie
  środowiska DOM to zmiana narzędziowa poza zakresem (Moduł 3).

## Podejście do implementacji

Trzy fazy w kolejności „od bazy do ekranu", bo każda kolejna jest bezużyteczna bez poprzedniej,
a każda wcześniejsza jest bezpieczna bez następnej: migracja i `updateTeam` nie mają wywołującego,
trasa API nie ma nadawcy formularza, dopóki nie zmieni się ekran.

Sedno decyzji projektowej: **tryb odczytu znika, a nie zyskuje przełącznik**. `readOnly` był
potrzebny w S-04, bo `/teams/[id]` był jedynym ekranem bez zapisu; po tym fragmencie oba ekrany
zapisują i różnią się wyłącznie **celem** zapisu. Wyrażamy to jednym opcjonalnym propem `teamId`:
jego brak znaczy „tworzenie", jego obecność znaczy „edycja tej drużyny". Stan „edycja bez id" jest
wtedy niereprezentowalny, a ostrzeżenie z `lessons.md` przestaje dotyczyć tego fragmentu, bo znika
druga strona pary.

Próg jest sprawdzany w **jednym** miejscu dla obu kierunków — `gateTeamSubmission`. Trasa edycji
nie dostaje własnej kopii reguły ani własnego progu; dostaje tylko inny cel zapisu.

## Krytyczne szczegóły implementacji

**Sekwencjonowanie fazy 3.** Cztery zmiany — `client:load` w `[id].astro`, zdjęcie `readOnly`
z `TeamComposer`, uczynienie `handlers` wymaganym w `RosterSlot` i podmiana `EmbarkGate` na
`CompositionGate` — muszą wejść **jednym commitem**.
Każda z osobna zostawia ekran w stanie cicho zepsutym, którego nie wykryje ani lint, ani typy, ani
testy: `client:load` bez pozostałych to hydratacja bez interakcji, a zdjęcie `readOnly` bez
`client:load` to ekran z przyciskami, które nic nie robią (`context/foundation/lessons.md`).

**Kolumnowy `grant update`.** Po `grant update (composition)` próba zapisu innej kolumny kończy się
błędem uprawnień z Postgresa, nie cichym pominięciem — komunikat jest mało czytelny, więc log
w `updateTeam` musi nieść oryginalny `error.message`, inaczej diagnoza w Workerze jest niemożliwa.

**Zero wierszy po update to nie awaria.** RLS ukrywa cudzy wiersz, więc `update … returning` na
cudzej lub nieistniejącej drużynie zwraca `null` bez `error`. To stan „nie ma czego zapisać",
a nie błąd zapytania — musi zejść inną gałęzią niż `throw`.

---

## Faza 1: Baza i warstwa danych

### Przegląd

Baza zaczyna przyjmować `update` na kolumnie `composition` własnego wiersza i nic poza tym; repo
zyskuje `updateTeam`. Nic poza tym — wydzielenie `team-composition.ts` (F7) zostaje follow-upem.

### Wymagane zmiany:

#### 1. Migracja: polityka `update` i kolumnowy przywilej

**Plik**: `supabase/migrations/20260906090000_teams_update_policy.sql` (nowy)

**Cel**: Odblokować podmianę składu własnej drużyny i **wyłącznie** składu. Domyka zobowiązanie
zapisane w komentarzu `20260905185700_teams_schema.sql:12-14`. Bez tej migracji trasa z fazy 2
kończy się bezgłośnie zerem zmienionych wierszy.

**Umowa**: Polityka `for update to authenticated` z **oboma** warunkami — `using (user_id = (select
auth.uid()))` wybiera wiersze do zmiany, `with check (user_id = (select auth.uid()))` blokuje
przepisanie wiersza na cudze konto; sam `using` na to nie wystarcza. Wzorzec `(select auth.uid())`
jak w istniejących politykach. Przywilej nadany **kolumnowo**, nie tabelowo:
`grant update (composition) on public.teams to authenticated` — to jest miejsce, w którym baza
egzekwuje FR-011 i niezmienność `user_id`, `id` oraz `created_at`. Plik nie dotyka `delete`
ani `truncate` (S-06). Nagłówek komentarza w stylu istniejących migracji: co, dlaczego kolumnowo,
i że próg dalej **nie** jest powtarzany w SQL.

#### 2. `updateTeam` w repo drużyn

**Plik**: `src/lib/team-repo.ts`

**Cel**: Podmienić `composition` istniejącego wiersza i odróżnić trzy wyniki, których wywołujący
musi nie pomylić: udany zapis, „nie ma takiej drużyny albo nie jest twoja", awaria zapytania.

**Umowa**: `updateTeam(supabase, input: { id: string; composition: TeamComposition }):
Promise<TeamSummary | null>`. Ładunek update'u to **wyłącznie** `{ composition }` — żadnego `name`,
`user_id` ani `id`. Zapytanie: `.update(...).eq("id", id).select(SUMMARY_SELECT).maybeSingle()`
(`returning` przechodzi przez politykę `select`, tak jak w `createTeam`). Kontrakt zwrotu:
`null`, gdy `id` nie przechodzi `isTeamId` **lub** gdy wiersz nie wrócił (nieznane id, cudzy wiersz
odcięty przez RLS) — nierozróżnialnie, dokładnie jak `getTeamSummary`; `throw` z `cause` wyłącznie
przy `error` z PostgREST. Docstring ma nazywać wprost, że nazwa nie wchodzi do ładunku, i wskazać
kolumnowy grant jako drugą, niezależną barierę.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Sprawdzanie typów i lint przechodzą: `npx astro sync && npm run lint`
- Testy przechodzą bez zmian w plikach testowych: `npm test`
- Build przechodzi: `npm run build`
- Migracja jest jedynym nowym plikiem w `supabase/migrations/` i nie dotyka `delete`:
  `git status --porcelain supabase/migrations/` oraz `! grep -qE '\bdelete\b|\btruncate\b'
  supabase/migrations/20260906090000_teams_update_policy.sql`
- Ładunek update'u nie niesie nazwy, właściciela ani daty:
  `! grep -nE '\.update\(\{[^}]*(name|user_id|created_at)' src/lib/team-repo.ts`

#### Ręczna weryfikacja:

- `supabase db push` stosuje migrację na projekcie hostowanym bez błędu (jedyna sankcjonowana
  ścieżka do bazy hostowanej — nigdy `supabase config push`)
- W dashboardzie Supabase tabela `teams` ma trzy polityki: insert, select, update — i **żadnej**
  dla delete
- **Produkcyjny `SUPABASE_KEY` zaczyna się od `sb_publishable_`, nie od `sb_secret_`.**
  Projekt używa nowego systemu kluczy Supabase: **publishable** (następca `anon` — bezpieczny dla
  przeglądarki, **RLS obowiązuje**) i **secret** (następca `service_role` — **RLS omijane**).
  Cała izolacja zapisu tego fragmentu stoi na RLS: `updateTeam` nie filtruje po `user_id`, więc
  klucz `sb_secret_` ominąłby nową politykę `update` i POST na cudze id faktycznie zmieniłby
  cudzy wiersz. Lokalny `.env` zweryfikowany 2026-09-06 (`sb_publishable_`); sprawdzić **sekret
  produkcyjny w Workerze** — `npx wrangler secret list` pokazuje wyłącznie nazwy, więc porównać
  z wartością w dashboardzie Supabase (API Keys) albo przestawić go na nowo
  `npx wrangler secret put SUPABASE_KEY` kluczem publishable. Ryzyko odziedziczone po S-04 (F8);
  do S-07 zostaje **weryfikacja**, nie samo założenie. Sprawdzić **zanim faza 2 wypuści trasę zapisu**.

---

## Faza 2: Trasa zapisu zmian

### Przegląd

`POST /api/teams/[id]` staje się drugim i ostatnim pisarzem do `teams`, dzielącym bramkę progu
z trasą tworzenia. Test regresyjny nazywa scenariusze US-02, żeby ryzyko „edycja przepuszcza skład
poniżej progu" miało dowód w CI, a nie komentarz.

### Wymagane zmiany:

#### 1. Komunikaty odrzucenia jako stałe

**Plik**: `src/lib/team-submission.ts`, `src/pages/api/teams/index.ts`,
`src/components/team/EmbarkGate.tsx`

**Cel**: Zdjąć trzecią kopię tekstu FR-018, zanim powstanie. Dziś ten sam zdanie stoi dwa razy —
`src/components/team/EmbarkGate.tsx:57` i `src/pages/api/teams/index.ts:62` — a trasa edycji
dołożyłaby trzecią. Bez tego punktu argument fazy 3 („bramka nie może się rozdwoić, bo komunikat
progu musi istnieć raz") jest nieprawdziwy w chwili zapisania.

**Umowa**: `team-submission.ts` eksportuje dwie stałe obok `COMPOSITION_FIELD`:
`BELOW_THRESHOLD_MESSAGE` (zbudowany z `COMPETENCY_THRESHOLD`, dosłownie dzisiejszy tekst
z `EmbarkGate.tsx:57`) i `INVALID_PAYLOAD_MESSAGE` (`"Invalid team payload"`). `EmbarkGate.tsx`
i `api/teams/index.ts` przestają trzymać literały i importują stałe — zmiana czysto mechaniczna,
bez zmiany widocznego tekstu. Trasa z punktu 2 i `CompositionGate` z fazy 3 importują te same
stałe. Dopiero po tym punkcie komunikat gotowości w bramce może różnić się między trybami
(„Save changes" vs „Embark on the job") bez rozdwojenia reguły.

#### 2. Trasa aktualizacji drużyny

**Plik**: `src/pages/api/teams/[id].ts` (nowy)

**Cel**: Przyjąć skład z natywnego formularza, przepuścić go przez tę samą bramkę progu co
tworzenie i zapisać na wskazanej drużynie — albo odrzucić przez redirect z `?error=`.

**Umowa**: `export const POST: APIRoute`. Kształt kopiowany z `src/pages/api/teams/index.ts`
punkt po punkcie, z jedną różnicą: cel redirectu to `/teams/${id}` zamiast `/teams/new`.
Kolejność bramek — brak `context.locals.user` → redirect na `/auth/signin` (obrona w głąb, prefiks
`/api/teams` jest już w `PROTECTED_ROUTES`); `createClient` zwrócił `null` → odrzucenie;
`request.formData()` w `try`/`catch` (`TypeError` przy spreparowanym ciele nie może wyjść z handlera);
pole `COMPOSITION_FIELD` nie jest stringiem → odrzucenie; `getCharacterPool` w `try`/`catch`;
`gateTeamSubmission(raw, pool)` z komunikatami **zaimportowanymi** z `team-submission`
(`INVALID_PAYLOAD_MESSAGE` / `BELOW_THRESHOLD_MESSAGE`, punkt 1) — żadnego literału tekstu
w trasie; `updateTeam` w `try`/`catch`.
Wyniki `updateTeam`: rekord → `context.redirect(\`/teams/${id}?saved=1\`)`; `null` → redirect
`/teams/${id}?error=` z komunikatem `"Could not save the team"` (ten sam, co gałąź `throw` —
gałęzie różnią się logiem, nie tym, co widzi gracz) (strona sama zdecyduje, czy pokazać błąd, czy 404 — cudza drużyna nie
wycieka, bo ta strona i tak renderuje 404 z pustym ciałem); `throw` → log + redirect z `?error=`.
**Żaden `throw` nie wychodzi z handlera** — nieprzechwycony throw w Workerze to 500.
`context.params.id` ma typ `string | undefined` i idzie do `updateTeam` bez zawężania — kontrolę
formatu robi `isTeamId` w repo; do budowy URL-a redirectu użyć `?? ""`, jak
`src/pages/teams/[id]/embark.astro:27`.

#### 3. Test regresyjny progu edycji

**Plik**: `src/lib/team-submission.test.ts`

**Cel**: Zapisać w CI, że próg działa **w obie strony** — nie tylko blokuje pierwszy zapis, ale
i cofa się przy edycji. To ryzyko S-05 z roadmapy wyrażone jako wykonywalne zdanie.

**Umowa**: Nowy blok `describe` („gateTeamSubmission — edycja zapisanej drużyny", US-02) nad
istniejącymi helperami `solvedComposition` / `rosterBuiltComposition`, bez ich zmiany.
Trzy przypadki, wszystkie startujące od składu domykającego próg: (1) `removeMember` członka
→ `gateTeamSubmission` zwraca `ok: false` z `below-threshold`; (2) `togglePerk` odznaczające perk,
który był ostatnim punktem swojej kompetencji → `below-threshold`; (3) `removeMember` + `addMember`
innej postaci utrzymujące próg → `ok: true`, a zwrócony skład zawiera nową postać, nie starą.
Skład startowy pochodzi z istniejącego `solvedComposition` (czyli z `findThresholdSolution`,
`src/lib/domain/solvability.ts:129`) — `roster.ts` (`addMember`/`removeMember`/`togglePerk`) służy
do wykonywania na nim **ruchów**, nie do zbudowania go od zera. Każdy skład przechodzi przez
`JSON.stringify`, bo bramka przyjmuje string — to jest ta sama droga, którą idzie formularz.

**Przypadki (2) i (3) muszą wyliczać swoje wejście z puli, nie zapisywać go na sztywno.**
Rozwiązanie solvera stawia wszystkie siedem kompetencji **dokładnie** na progu, więc oba są ciasne:
(2) każdy odznaczony perk cofa swoją kompetencję — wybrać go przez lookup `perkId → competency`
w `CHARACTER_POOL` (istniejący `perkIdsOf` zwraca same id, więc dopisać obok niego mały helper;
istniejących helperów nie zmieniamy); (3) po usunięciu członka próg domyka **dokładnie jedna**
postać z puli (dziś `marlow` po usunięciu `vesper`), więc test ma ją **znaleźć** — pierwsza wolna
postać, dla której `gateTeamSubmission` zwraca `ok: true` — a nie wziąć pierwszej z brzegu ani
wpisać identyfikatora. Pula może się zmienić i oba twarde wpisy rozsypałyby się po zmianie seeda.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Nowe testy przechodzą, stare bez zmian: `npm test`
- Lint i typy przechodzą: `npx astro sync && npm run lint`
- Build przechodzi: `npm run build`
- Trasa nie zwraca JSON-a: `! grep -nE "Response\.json|new Response|JSON\.stringify" 'src/pages/api/teams/[id].ts'`
- Każda gałąź kończy się redirectem, a liczba `return` równa się liczbie `context.redirect`:
  `test "$(grep -c 'return ' 'src/pages/api/teams/[id].ts')" = "$(grep -c 'context.redirect' 'src/pages/api/teams/[id].ts')"`
- Reguła progu nie ma drugiej kopii **ani w liczeniu, ani w tekście**:
  `! grep -rn "COMPETENCY_THRESHOLD\|evaluateTeam" src/pages/api/` oraz
  `! grep -rn "Every competency needs\|Invalid team payload" src/pages/api/ src/components/`
  (oba komunikaty przychodzą wyłącznie importem z `@/lib/team-submission`)

#### Ręczna weryfikacja:

- `curl -X POST` na `/api/teams/<własne-id>` z ciałem niebędącym formularzem kończy się redirectem
  z `?error=`, nie 500
- POST na `/api/teams/<cudze-id>` (drugie konto) nie zmienia cudzego wiersza i nie ujawnia, że
  istnieje
- POST na `/api/teams/nie-uuid` kończy się redirectem, nie błędem Postgresa `22P02`

---

## Faza 3: Ekran edycji

### Przegląd

`/teams/[id]` przestaje być martwym podglądem i staje się ekranem edycji. Tryb odczytu znika
z `TeamComposer` w całości, a `EmbarkGate` uogólnia się do `CompositionGate` obsługującej oba
cele zapisu. **Cała faza to jeden commit** — cztery pliki wyrażają jeden przełącznik.

### Wymagane zmiany:

#### 1. `EmbarkGate` → `CompositionGate`

**Plik**: `src/components/team/CompositionGate.tsx` (przemianowany z `EmbarkGate.tsx`),
`src/lib/team-submission.ts`

**Cel**: Jedna bramka dla obu kierunków zapisu, żeby próg, `disabled`, ukryte pole JSON i komunikat
FR-018 istniały dokładnie raz. Domyka zobowiązanie F5 z przeglądu planu S-04.

**Umowa**: `CompositionGate({ ready, composition, teamId }: { ready: boolean; composition:
TeamComposition; teamId?: string })`. Tryb wynika **wyłącznie** z obecności `teamId` — nie ma
osobnej flagi trybu, więc „edycja bez id" i „tworzenie z id" są niereprezentowalne. Brak `teamId`
→ `action="/api/teams"`, etykiety „Embark on the job" / „Embarking…". `teamId` obecne →
`action={\`/api/teams/${teamId}\`}`, etykiety „Save changes" / „Saving…". Komunikat niespełnionego
progu przychodzi **importem** `BELOW_THRESHOLD_MESSAGE` z `@/lib/team-submission` (faza 2, pkt 1),
ten sam dla obu trybów i ten sam, którym odrzucają obie trasy — reguła FR-018 ma jeden tekst
w całym drzewie. Komunikat gotowości może różnić się między trybami. Powodem, dla którego komponent
się nie rozdwaja, jest **próg i `disabled`**, nie tekst: dwie bramki oznaczałyby dwie kopie
warunku `!ready`. Reszta bez
zmian: `disabled={!ready || submitting}` jako jedyna bariera progu, `onSubmit` wyłącznie jako zapis
„już wysłano" przeciw dwuklikowi, brak `preventDefault`, brak `useFormStatus` (React nie ustawia
`pending` dla `action` będącego stringiem — ustalenie F2 z przeglądu S-03). Docstring ma zostać
przepisany na obie role (FR-007 i FR-009); stary opis mówi wyłącznie o tworzeniu.

Razem z przemianowaniem idzie **jedna linia poza komponentem**: docstring `COMPOSITION_FIELD`
w `src/lib/team-submission.ts:19` („wspólna dla `EmbarkGate` i `POST /api/teams`") to czwarte
i ostatnie wystąpienie nazwy `EmbarkGate` w `src/` — bez niego kryterium 3.5 świeci na czerwono.
Nowa treść nazywa `CompositionGate` i **obie** trasy zapisu.

#### 2. `TeamComposer` bez trybu odczytu

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Usunąć prop `readOnly` w całości. Po tym fragmencie oba ekrany są interaktywne i różnią
się wyłącznie celem zapisu, więc tryb odczytu nie ma konsumenta — a jego usunięcie **likwiduje**
parę przełączników z `context/foundation/lessons.md`, zamiast wymagać jej pilnowania.

**Umowa**: Props: `{ pool, initialComposition?, teamId? }`; `readOnly` znika razem z trzema
gałęziami warunkowymi (`handlers` jest teraz zawsze obiektem, `MemberPickerDialog` zawsze montowany,
bramka zawsze renderowana). `teamId` jest przekazywane **przelotowo** do `CompositionGate` —
`TeamComposer` nie rozgałęzia się na nim ani razu. Komentarz o nieznanym `characterId` (linie 84–86)
zostaje i wymaga aktualizacji: `resolveSavedTeam` dalej jest tym, co odcina taki skład przed wyspą,
i staje się teraz **jedyną** ochroną edycji przed zapisaniem okrojonego składu. Docstring o wartości
początkowej `useState` bez `useEffect` zostaje bez zmian — to jest właśnie ta decyzja, która pozwala
edycji nie mieć dwóch źródeł prawdy.

#### 3. `RosterSlot` bez opcjonalnych akcji

**Plik**: `src/components/team/RosterSlot.tsx`

**Cel**: Domknąć **trzeci** nośnik trybu odczytu. Tryb odczytu nie był wyrażony dwoma
przełącznikami, tylko trzema: `readOnly` w wyspie, brak `client:*` w `.astro` i **opcjonalność**
`handlers` w slocie (`RosterSlot.tsx:26-35`). Zdjęcie samego `readOnly` zostawia trzeci na miejscu:
gałęzie `onRecruit === undefined` i perki jako `<span>` stają się kodem martwym, a docstring
opisuje tryb, którego nie ma — dokładnie ten kształt cichej awarii, przed którym ostrzega
`context/foundation/lessons.md`.

**Umowa**: `handlers: RosterSlotHandlers` staje się **wymagany** (`?` znika), a lokalne `const`
z linii 51–54 tracą `?.`. Usunąć obie gałęzie trybu odczytu: pusty slot bez `onRecruit` (linie
58–66) i perki renderowane jako `<span>` — po tej zmianie pusty slot jest zawsze przyciskiem
„Recruit", a perk zawsze przełącznikiem. Docstring `RosterSlotProps` i akapit „W trybie odczytu
(`handlers` pominięte)…" znikają razem z gałęziami. Po tym punkcie typ nie dopuszcza stanu „slot
bez akcji", więc trzeci przełącznik nie może się już rozjechać z pozostałymi dwoma.

#### 4. Strona edycji zapisanej drużyny

**Plik**: `src/pages/teams/[id].astro`

**Cel**: Przywrócić hydratację, przekazać `teamId` do wyspy i obsłużyć dwa nowe stany wracające
z trasy zapisu: potwierdzenie i błąd. Domyka zobowiązanie F2 z przeglądu planu S-04.

**Umowa**: `<TeamComposer pool={pool} initialComposition={composition} teamId={team.id} client:load />`
— `client:load` wraca, `readOnly` znika, komentarz o świadomym braku hydratacji (linie 97–104) jest
usuwany w całości razem z notą dla S-05. Komentarz nagłówkowy frontmattera (linia 10, „ten sam
`TeamComposer` co kompletowanie, **w trybie odczytu**") przestaje być prawdą i idzie razem z nimi —
nowa treść mówi o jednym ekranie oglądania i edycji (FR-008 + FR-009). Frontmatter dokłada odczyt `Astro.url.searchParams`:
`saved` (obecność → pasek potwierdzenia nad wyspą) i `error` (renderowany istniejącym
`ServerError` z `@/components/auth/ServerError`, tak jak robi to `src/pages/teams/new.astro:47`).
Oba paski renderują się **wyłącznie** w gałęzi, w której wyspa jest widoczna — na ekranie 404 ani
na ekranie „drużyna niedostępna" nie mają sensu i nie mogą ujawniać, że POST dotarł. Reszta
frontmattera bez zmian: `Astro.response.status = 404` zamiast top-level `return`, `Promise.allSettled`
na dwa niezależne odczyty, `resolveSavedTeam` jako bramka spójności z pulą. Nagłówek strony
(`Team <hash>`) zostaje — jest jedynym nośnikiem nazwy i **nie** jest polem formularza (FR-011).

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Lint i typy przechodzą: `npx astro sync && npm run lint`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`
- Prop `readOnly` nie istnieje nigdzie w drzewie: `! grep -rn "readOnly" src/`
- Nazwa `EmbarkGate` nie została nigdzie: `! grep -rn "EmbarkGate" src/`
- Każde renderowanie `TeamComposer` ma `client:load`: `grep -rn "<TeamComposer" src/pages/` zwraca
  dokładnie dwa wiersze i oba zawierają `client:load`
- Cała faza jest jednym commitem: `git show --stat HEAD` wymienia `CompositionGate.tsx`,
  `TeamComposer.tsx`, `RosterSlot.tsx` i `[id].astro` razem

#### Ręczna weryfikacja:

- Wejście na `/teams/<własne-id>` pokazuje zapisany skład z klikalnymi slotami i przyciskiem
  „Save changes"
- Usunięcie członka cofające próg **natychmiast** blokuje przycisk i pokazuje komunikat FR-018;
  ponowne dodanie postaci domykającej próg go odblokowuje (dwukierunkowość, US-02 AC)
- Wymiana członka i zapis → powrót na `/teams/<id>` z paskiem potwierdzenia, a odświeżenie strony
  pokazuje **nowy** skład (dowód trwałości, nie stan wyspy)
- Nazwa-hash w nagłówku jest identyczna przed i po zapisie (FR-011)
- Wyjście ze strony bez zapisu i ponowne wejście przywraca skład zapisany (brak wersji roboczych)
- Drugie konto: `/teams/<cudze-id>` dalej pokazuje 404, a nie ekran edycji (US-04)
- Wykres pajęczynowy aktualizuje się przy każdej zmianie w czasie nieodczuwalnym (NFR < 200 ms)

---

## Strategia testowania

### Testy jednostkowe:

- **Próg działa w obie strony** (faza 2, `src/lib/team-submission.test.ts`) — usunięcie członka
  i odznaczenie perka cofające kompetencję poniżej dwóch punktów są odrzucane przez tę samą bramkę,
  którą woła trasa edycji; poprawna wymiana członka przechodzi.
- **Bez zmian w istniejących testach** — faza 1 nie dotyka `src/lib/team-submission.test.ts`
  w ogóle (jej diff musi być pusty); po fazie 2 plik zawiera wyłącznie dopisany blok.

### Testy integracyjne:

Brak — trasa API i strona `.astro` importują `astro:*` i `@/lib/supabase`, więc są poza zasięgiem
czystego Vitest (AGENTS.md → Hard rules). Ich pokrycie jest ręczne i wypisane niżej; warstwa
integracyjna wchodzi w Module 3.

### Kroki testowania ręcznego:

1. `supabase db push`, potem `npm run dev`; zalogować się i otworzyć zapisaną drużynę z `/teams`.
2. Usunąć jednego członka → przycisk „Save changes" blokuje się z komunikatem o progu; wykres
   pokazuje kompetencję poniżej dwóch punktów.
3. Dodać inną postać domykającą próg → przycisk odblokowuje się. Zapisać.
4. Sprawdzić, że powrót nastąpił na `/teams/<id>` z paskiem potwierdzenia, nazwa-hash jest ta sama,
   a **twarde odświeżenie** pokazuje nowy skład.
5. Sprawdzić `/teams` — ta sama drużyna, ta sama nazwa, jeden wiersz (edycja nie utworzyła drugiej).
6. Otworzyć drużynę, zmienić skład i **wyjść bez zapisu**; wrócić → skład zapisany, nie porzucony.
7. Zalogować się na drugie konto i wejść na `/teams/<id>` pierwszego → 404. Wysłać POST formularzem
   spoza aplikacji na `/api/teams/<cudze-id>` → wiersz pierwszego konta nietknięty.
8. `POST /api/teams/<własne-id>` ze spreparowanym ciałem (nie-formularz, pusty `composition`,
   skład poniżej progu) → za każdym razem redirect z `?error=`, nigdy 500 i nigdy zapis.

## Uwagi dotyczące wydajności

Bez nowych obciążeń. Strona edycji robi te same dwa równoległe odczyty co dziś (`Promise.allSettled`
na drużynę i pulę), a trasa zapisu robi jeden odczyt puli i jeden update — dokładnie tyle, ile trasa
tworzenia. `evaluateTeam` liczy się przy każdym renderze wyspy bez memoizacji (siedem liczników nad
≤ 6 członkami), co S-01 zmierzył jako mieszczące się w NFR 200 ms z zapasem. Jedyna zmiana po
stronie klienta to hydratacja `/teams/[id]`, która wcześniej nie ładowała JS — koszt równy stronie
`/teams/new`, akceptowany świadomie jako cena FR-009.

## Uwagi dotyczące migracji

Migracja fazy 1 jest **wyłącznie addytywna**: dodaje politykę i przywilej, nie zmienia ani nie
usuwa niczego istniejącego. Wycofanie to `drop policy` plus `revoke update` — kod sprzed tego
fragmentu działa na bazie po migracji bez zmian, bo nic go nie zmusza do update'u.

Kolejność wdrożenia jest wiążąca: **migracja przed kodem**. Kod fazy 3 wdrożony przed migracją daje
przycisk „Save changes", który cicho nie zapisuje (zero wierszy, brak błędu) — czyli dokładnie ten
tryb awarii, przed którym broni FR-009. Odwrotna kolejność jest bezpieczna: migracja bez kodu nie
ma wywołującego.

Istniejące wiersze `teams` nie wymagają backfillu — zmienia się wyłącznie zestaw uprawnień.

## Referencje

- Element mapy drogowej: `context/foundation/roadmap.md` → S-05
- Wymaganie wstępne (zarchiwizowane): `context/archive/2026-09-06-own-teams-list-and-detail/plan.md`
- Zobowiązania F2 i F5:
  `context/archive/2026-09-06-own-teams-list-and-detail/reviews/plan-review.md:156-159`
- Follow-up F7: `context/archive/2026-09-06-own-teams-list-and-detail/follow-ups/review-fixes.md`
- Lekcje wiążące ten plan: `context/foundation/lessons.md` (wyspa bez `client:*`; brak top-level
  `return` w `.astro`)
- Wzorzec trasy zapisu: `src/pages/api/teams/index.ts`
- Wzorzec migracji z politykami i grantami: `supabase/migrations/20260905185700_teams_schema.sql`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Baza i warstwa danych

#### Automatyczne

- [x] 1.1 Sprawdzanie typów i lint przechodzą (`npx astro sync && npm run lint`) — aae8fcf
- [x] 1.2 Testy przechodzą bez zmian w plikach testowych (`npm test`) — aae8fcf
- [x] 1.3 Build przechodzi (`npm run build`) — aae8fcf
- [x] 1.4 Migracja jest jedynym nowym plikiem i nie dotyka `delete`/`truncate` — aae8fcf
- [x] 1.5 Ładunek update'u nie niesie nazwy, właściciela ani daty — aae8fcf

#### Ręczne

- [x] 1.6 `supabase db push` stosuje migrację bez błędu — aae8fcf
- [x] 1.7 Tabela `teams` ma polityki insert/select/update i żadnej dla delete — aae8fcf
- [x] 1.8 Produkcyjny `SUPABASE_KEY` zaczyna się od `sb_publishable_`, nie `sb_secret_` — aae8fcf

### Faza 2: Trasa zapisu zmian

#### Automatyczne

- [x] 2.1 Nowe testy przechodzą, stare bez zmian (`npm test`) — f21508b
- [x] 2.2 Lint i typy przechodzą (`npx astro sync && npm run lint`) — f21508b
- [x] 2.3 Build przechodzi (`npm run build`) — f21508b
- [x] 2.4 Trasa nie zwraca JSON-a — f21508b
- [x] 2.5 Każda gałąź kończy się `context.redirect` (liczba `return` == liczba `context.redirect`) — f21508b
- [x] 2.6 Reguła progu nie ma drugiej kopii ani w liczeniu, ani w tekście komunikatu — f21508b

#### Ręczne

- [x] 2.7 POST z ciałem niebędącym formularzem kończy się `?error=`, nie 500 — f21508b
- [x] 2.8 POST na cudze id nie zmienia wiersza i nie ujawnia jego istnienia — f21508b
- [x] 2.9 POST na nie-UUID kończy się redirectem, nie błędem `22P02` — f21508b

### Faza 3: Ekran edycji

#### Automatyczne

- [x] 3.1 Lint i typy przechodzą (`npx astro sync && npm run lint`) — 1d5b152
- [x] 3.2 Testy przechodzą (`npm test`) — 1d5b152
- [x] 3.3 Build przechodzi (`npm run build`) — 1d5b152
- [x] 3.4 Prop `readOnly` nie istnieje nigdzie w `src/` — 1d5b152
- [x] 3.5 Nazwa `EmbarkGate` nie została nigdzie w `src/` — 1d5b152
- [x] 3.6 Oba renderowania `TeamComposer` mają dyrektywę hydratacji — 1d5b152
- [x] 3.7 Cała faza weszła jednym commitem (cztery pliki razem) — 1d5b152

#### Ręczne

- [x] 3.8 `/teams/<własne-id>` pokazuje edytowalny skład z przyciskiem „Save changes" — 1d5b152
- [x] 3.9 Usunięcie członka blokuje zapis, ponowne domknięcie progu odblokowuje (dwukierunkowość) — 1d5b152
- [x] 3.10 Zapis wraca na `/teams/<id>` z potwierdzeniem, a odświeżenie pokazuje nowy skład — 1d5b152
- [x] 3.11 Nazwa-hash jest identyczna przed i po zapisie — 1d5b152
- [x] 3.12 Wyjście bez zapisu nie utrwala zmian — 1d5b152
- [x] 3.13 Drugie konto dalej dostaje 404 na `/teams/<cudze-id>` — 1d5b152
- [x] 3.14 Wykres aktualizuje się w czasie nieodczuwalnym (< 200 ms) — 1d5b152
