<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: edycja składu zapisanej drużyny (S-05)

- **Plan**: context/changes/edit-saved-team/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny plan), commity `aae8fcf`, `f21508b`, `1d5b152`, `4175bb7`
- **Data**: 2026-09-06
- **Werdykt**: WYMAGA UWAGI → **ZAAKCEPTOWANO po triażu 2026-09-06** (F1, F2, F3, F5 naprawione; F4, F6 pominięte świadomie)
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 4 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | WARNING |

## Weryfikacja kryteriów automatycznych

Wszystkie przechodzą (Node 22.14.0):

| Kryterium | Wynik |
|---|---|
| `npm run lint` (po `npx astro sync`) | PASS — exit 0, wyłącznie ostrzeżenia `astro-eslint-parser` o `projectService` |
| `npm test` | PASS — 11 plików, 125 testów |
| `npm run build` | PASS — exit 0, `Complete!` |
| 1.4 migracja bez `delete`/`truncate` | PASS |
| 1.5 ładunek update bez `name`/`user_id`/`created_at` | PASS |
| 2.4 trasa nie zwraca JSON-a | PASS |
| 2.5 `return` == `context.redirect` | PASS — 9 == 9 |
| 2.6 brak drugiej kopii progu (liczenie i tekst) | PASS — oba grepy puste |
| 3.4 `readOnly` nie istnieje w `src/` | PASS |
| 3.5 `EmbarkGate` nie istnieje w `src/` | PASS |
| 3.6 oba `<TeamComposer>` z `client:load` | PASS — `new.astro:49`, `[id].astro:115` |
| 3.7 faza 3 jednym commitem | PASS — `1d5b152` niesie `CompositionGate.tsx`, `TeamComposer.tsx`, `RosterSlot.tsx`, `[id].astro` razem |

Kryteria ręczne 2.7–2.9 i 3.8–3.14 są odhaczone i wewnętrznie spójne z kodem. Kryteria 1.6, 1.7
i 1.8 dotyczą stanu poza repozytorium — patrz F1.

## Ustalenia

### F1 — Kryterium 1.8 odhaczone bez artefaktu: produkcyjny `SUPABASE_KEY` niezweryfikowany

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/changes/edit-saved-team/plan.md (Progress 1.8); src/lib/team-repo.ts:119-142
- **Szczegóły**: Cała izolacja zapisu tego fragmentu stoi na RLS — `updateTeam` świadomie **nie**
  filtruje po `user_id` (`team-repo.ts:11-14`: „żadna funkcja nie filtruje po `user_id`, bo drugi
  warunek sugerowałby, że RLS sam nie wystarcza"). Przy kluczu `sb_secret_` RLS jest omijane
  i `POST /api/teams/<cudze-id>` faktycznie zmieniłby cudzy wiersz — Guardrail US-04 padłby
  w całości, bez żadnego sygnału w kodzie ani w CI. Lokalny `.env` sprawdziłem: `sb_publishable_`.
  Produkcyjny sekret w Workerze **nie ma śladu weryfikacji** — `npx wrangler secret list` pokazuje
  wyłącznie nazwy, więc plan sam wskazywał porównanie z dashboardem albo przestawienie sekretu.
  Pozycja jest odhaczona `— aae8fcf`, a commit `aae8fcf` nie zawiera niczego, co by ją potwierdzało.
  To samo dotyczy 1.6 (`supabase db push`) i 1.7 (trzy polityki w dashboardzie), ale te zawodzą
  głośno przy pierwszym ręcznym zapisie; 1.8 zawodzi **cicho i tylko cross-account**.
- **Poprawka A ⭐ Zalecane**: Porównać wartość `SUPABASE_KEY` w Workerze z kluczem publishable
  w dashboardzie Supabase (API Keys), a wynik dopisać jako datowaną notatkę przy Progress 1.8.
  - Siła: Nie dotyka produkcji — czynność wyłącznie odczytowa, a jedyne ryzyko to potwierdzenie
    stanu, którego dziś nikt nie zna.
  - Kompromis: Wymaga ręcznego wejścia do dwóch paneli; wynik nie jest artefaktem w repo,
    więc następny przegląd znów go nie zobaczy bez tej notatki.
  - Pewność: WYSOKA — plan wprost przewidział tę ścieżkę, a lokalny odpowiednik już się zgadza.
  - Martwy punkt: Nie sprawdzono, czy sekret nie był ustawiany dwukrotnie (kolejne `secret put`
    nadpisuje po cichu).
- **Poprawka B**: `npx wrangler secret put SUPABASE_KEY` kluczem publishable — bez sprawdzania,
  co tam stoi dziś.
  - Siła: Deterministyczna — po wykonaniu stan jest znany niezależnie od tego, jaki był wcześniej.
  - Kompromis: Zapis do produkcji i redeploy Workera; jeśli sekret był poprawny, to zmiana bez
    powodu, a jeśli był niepoprawny, tracimy dowód, że kiedykolwiek taki był.
  - Pewność: ŚREDNIA — działa, ale zaciera diagnozę.
  - Martwy punkt: Nie zweryfikowano, czy Worker po zmianie sekretu wymaga ponownego wdrożenia.
- **Decyzja**: NAPRAWIONE poprawką A — weryfikacja wykonana ręcznie 2026-09-06: sekret w Workerze
  produkcyjnym zaczyna się od `sb_publishable_`, więc RLS obowiązuje i izolacja zapisu US-04 trzyma.
  Dowód zapisany jako datowana notatka pod Progress 1.8 w `plan.md`, razem ze stawką i z warunkiem,
  że każda przyszła podmiana sekretu musi tę weryfikację powtórzyć.

### F2 — Migracja niosąca FR-011 i izolację zapisu nie ma testu, mimo istniejącego precedensu

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: supabase/migrations/20260906090000_teams_update_policy.sql:22-27
- **Szczegóły**: Dwie gwarancje tego fragmentu — „nazwy-hasha nie da się zmienić" (FR-011)
  i „nie da się przepisać wiersza na cudze konto" (US-04) — mieszkają wyłącznie w dwóch
  fragmentach tekstu SQL: `with check (user_id = (select auth.uid()))` oraz
  `grant update (composition) on public.teams to authenticated`. Obie są napisane poprawnie, ale
  **nic ich nie weryfikuje**: przyszła migracja dokładająca tabelowy `grant update on public.teams`
  (np. przy S-06) rozbroiłaby kolumnową barierę, a lint, testy i typy przeszłyby na zielono.
  Repozytorium ma już wzorzec na dokładnie ten problem: `src/lib/domain/character-pool-sql.test.ts`
  czyta `supabase/migrations/` przez `node:fs` i asercjuje treść, mieszcząc się w twardej regule
  czystości testów (bez `astro:*`, bez `@/lib/supabase`).
- **Poprawka**: Dopisać w `src/lib/` test na wzór `character-pool-sql.test.ts`, asercjujący
  w `20260906090000_teams_update_policy.sql` obecność `with check (user_id = (select auth.uid()))`
  i `grant update (composition) on public.teams`, oraz **brak** tabelowego
  `grant update on public.teams` w całym katalogu migracji.
- **Decyzja**: NAPRAWIONE — dopisany `src/lib/teams-policy-sql.test.ts` (4 przypadki): `with check`
  obok `using`, kolumnowy grant, brak tabelowego `grant update on public.teams` w całym katalogu
  i brak przywileju `delete` (granica S-06 zapisana jako test). Migracje są czytane **bez
  komentarzy** — te pliki opisują w prozie przywileje, których nie nadają, więc surowy tekst
  dawałby trafienia na zdaniach o DDL. Test zweryfikowany mutacyjnie: usunięcie `with check` daje
  1 czerwony, podmiana grantu na tabelowy — 2 czerwone; migracja przywrócona bez zmian.
  `npm test` 129/129, `eslint` na nowym pliku exit 0.

### F3 — Odrzucony zapis gubi niezapisaną edycję bez ostrzeżenia

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/teams/[id].ts:38; src/components/team/TeamComposer.tsx:52
- **Szczegóły**: Każda odmowa wraca na `/teams/<id>?error=…`, a strona odtwarza wyspę z bazy —
  `initialComposition` jest wartością początkową `useState`, więc gracz widzi skład **sprzed**
  edycji. Ścieżki `below-threshold` i `invalid-payload` są z interfejsu nieosiągalne (`disabled`),
  ale „Character pool is unavailable" i `SAVE_FAILED_MESSAGE` przy przemijającej awarii Supabase
  są realne — i to dokładnie wtedy gracz spróbowałby ponownie. Zachowanie jest bliskie
  udokumentowanym Non-Goals („wersje robocze", „brak Discard changes"), które mówią o **wyjściu
  ze strony**, nie o nieudanym zapisie; ta sama luka istnieje już na `/teams/new`, więc fragment
  jej nie wprowadza, tylko dziedziczy.
- **Poprawka**: Zaakceptować świadomie i dopisać jedno zdanie przy `reject` w `[id].ts:38`, że
  odrzucenie kosztuje niezapisaną edycję i jest to przyjęte przy tej skali.
- **Decyzja**: NAPRAWIONE — dopisany akapit przy `reject` w `src/pages/api/teams/[id].ts`: odesłanie
  kosztuje niezapisaną edycję, ścieżki `below-threshold` i `invalid-payload` są z interfejsu
  nieosiągalne, więc realnie zostają awarie przemijające, a przenoszenie składu przez URL albo
  `sessionStorage` dokładałoby drugie źródło prawdy — dokładnie to, czemu zapobiega brak `useEffect`
  w wyspie. Koszt przyjęty świadomie. Kryterium 2.5 nietknięte (9 `return` == 9 `context.redirect`).

### F4 — `ServerError` milczy dokładnie w tej gałęzi, w której trasa go wysłała

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/teams/[id].astro:102,113
- **Szczegóły**: `<ServerError message={error} />` żyje wyłącznie w gałęzi
  `composition !== null && pool !== null`. Trasa odrzuca m.in. komunikatem
  „Character pool is unavailable" (`[id].ts:68`) — ale jeśli pula padła dla POST-a, to przy
  natychmiastowym GET-cie zwykle padła też dla strony, więc `pool === null` i gracz dostaje
  generyczne „Team is unavailable right now" zamiast przekazanego komunikatu. Umieszczenie pasków
  wyłącznie w tej gałęzi jest **poprawne i wymagane** dla 404 (nie wolno zdradzić, że POST dotarł),
  ale gałąź awarii puli to nie cudza drużyna — tam ukrywanie nic nie chroni.
- **Poprawka**: Wyrenderować `<ServerError>` również w gałęzi awarii, ale tylko gdy strona nie jest
  404 ani „skład niespójny z pulą" — czyli zachować milczenie wyłącznie tam, gdzie chroni US-04.
- **Decyzja**: POMINIĘTE — oba teksty i tak sprowadzają się do „spróbuj za chwilę", a poprawka
  dokłada warunek do szablonu w gałęzi, która i tak jest awaryjna. Świadome pominięcie.

### F5 — Ładunek formularza bez limitu rozmiaru przed parsowaniem i ewaluacją

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/teams/[id].ts:54,71 (bliźniaczo src/pages/api/teams/index.ts:45,62)
- **Szczegóły**: `gateTeamSubmission` dostaje surowy string bez kontroli długości.
  `parseTeamComposition` iteruje całą tablicę, a `evaluateTeam` (`src/lib/domain/evaluate-team.ts`)
  nie ma wczesnego wyjścia — przy `too-many-members` dopisuje naruszenie i mimo to przechodzi całą
  pętlą, a `violations` rośnie po jednym wpisie na członka. Zalogowane konto może wysłać
  wielomegabajtową tablicę i spalić CPU Workera. Poprawny skład to < 1 KB (6 członków × 2 perki).
  Wymaga uwierzytelnienia i Cloudflare tnie CPU, więc to twardnienie, nie dziura.
- **Poprawka**: Odrzucać jako `invalid-payload` w `gateTeamSubmission`, gdy `raw.length` przekracza
  ustalony limit — jedna zmiana obejmuje obie trasy, bez dotykania domeny.
- **Decyzja**: NAPRAWIONE — limit `MAX_COMPOSITION_PAYLOAD_BYTES` w `src/lib/team-submission.ts`,
  wyprowadzony ze stałych domeny (`MAX_TEAM_SIZE × (MAX_PERKS_PER_MEMBER + 1) × 64 + 512` = 1664 B),
  nie wpisany z palca. Stoi w `parseTeamComposition` **przed** `JSON.parse` — tam siedzi faktyczny
  koszt, a obie trasy dziedziczą go przez bramkę; `parseTeamComposition` nie ma innych importerów
  poza bramką i testami. Trzy nowe testy: uczciwy skład mieści się poniżej **połowy** limitu (żeby
  przyszłe wydłużenie identyfikatorów spadło na teście, nie na graczu), przerośnięty ładunek
  o poprawnym kształcie jest odrzucany za sam rozmiar, a bramka mapuje go na `invalid-payload`,
  nie `below-threshold`. `npm test` 132/132, lint exit 0, kryterium 2.6 nietknięte.

### F6 — Cztery dodatki poza umową planu

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/components/team/CompositionGate.tsx:1,45; src/pages/api/teams/[id].ts:31,38;
  src/pages/api/teams/index.ts:13-22
- **Szczegóły**: Cztery zmiany, których plan nie opisywał, żadna nie przekracza granicy
  „Czego NIE robimy": (1) podmiana ikony `Rocket` → `Save` w trybie edycji — plan wymieniał tylko
  etykiety; (2) `SAVE_FAILED_MESSAGE` wyciągnięte do stałej modułowej, gdzie plan mówił o literale
  użytym w dwóch gałęziach; (3) helper odrzucenia jako domknięcie zwracające string, gdzie trasa
  wzorcowa ma funkcję modułową zwracającą `Response` (wymuszone zależnością od `id`, skomentowane);
  (4) docstring `api/teams/index.ts` zaktualizowany o istnienie drugiego pisarza, gdzie plan
  przewidywał wyłącznie mechaniczną podmianę literałów na importy. Wszystkie cztery są ulepszeniami
  i żadna nie zmienia zachowania widocznego dla gracza ani reguły domenowej.
- **Poprawka**: Pominąć — udokumentować w epilogu planu jako świadome dodatki, jeśli w ogóle.
- **Decyzja**: POMINIĘTE — cztery kosmetyczne ulepszenia, żadne nie rusza granic „Czego NIE robimy"
  ani reguły domenowej. Świadome pominięcie: plan nie jest przepisywany pod drobiazgi.

## Zweryfikowane i czyste

Zbadane i bez zastrzeżeń — odnotowane, żeby przyszły przegląd nie sprawdzał ich od zera:

- **Granice zakresu**: żadna z dziewięciu pozycji „Czego NIE robimy" nie została przekroczona.
  Brak edycji nazwy (jedyne pole formularza to ukryty `composition`), brak wersji roboczych, brak
  blokad optymistycznych, brak `beforeunload`/`discard`/dirty-trackingu, brak polityki i grantu
  `delete`, brak `src/lib/team-composition.ts` (F7 dalej follow-upem — `toTeamComposition` ma
  wciąż jednego importera), brak testów `.test.tsx`.
- **Migracja**: `using` **i** `with check`, wzorzec `(select auth.uid())`, grant kolumnowy, zero
  `drop`/`alter column`/`delete`/`truncate` — addytywna i odwracalna, bez backfillu.
- **Izolacja zapisu**: `update … where id` z RLS `using` zmienia zero wierszy dla cudzej drużyny,
  a `maybeSingle()` zwraca wtedy `null` **bez** `error`; trasa oddaje ten sam
  `SAVE_FAILED_MESSAGE` dla `null` i dla awarii zapytania, różnicując wyłącznie poziom logu —
  brak enumeracji.
- **Niezawodność trasy**: `formData()`, `getCharacterPool` i `updateTeam` każde w `try`/`catch`;
  żaden `throw` nie wychodzi z handlera. `context.params.id` idzie do repo bez zawężania,
  `isTeamId` odcina nie-UUID przed błędem Postgresa `22P02`.
- **XSS i open-redirect**: `ServerError` renderuje `{message}` jako dziecko JSX; `set:html` nie
  występuje nigdzie w `src/`. Astro nie dekoduje segmentu ścieżki przed `getParams`, a cel
  odesłania zawsze zaczyna się od `/teams/`, więc ani CRLF, ani protocol-relative URL nie wchodzą.
- **CSRF**: ciasteczka `@supabase/ssr` mają `sameSite: "lax"`, więc cross-site POST ich nie niesie.
- **Reguły AGENTS.md**: null-check `createClient()` w trasie i na stronie; sekrety wyłącznie przez
  `astro:env/server`; wszystkie odmowy przez `?error=`, zero JSON-a; repo bierze klienta argumentem
  i rzuca; importy przez `@/*`; klasy przez `cn()`; `/api/teams/<id>` objęte prefiksem
  `/api/teams` w `PROTECTED_ROUTES`; `zod` nie doszła; testy importują tylko `@/lib/domain`
  i `@/lib/team-submission`.
- **Wszystkie trzy lekcje z `lessons.md` uszanowane.** Lekcja o parze „wyspa bez `client:*`
  + flaga trybu odczytu" rozliczona wzorcowo: `readOnly` zniknęło, `handlers` w `RosterSlot` stało
  się **wymagane** (typ nie dopuszcza już slotu bez akcji, więc trzeci przełącznik przestał
  istnieć), a `client:load` wróciło — wszystko w jednym commicie `1d5b152`.
- **Test regresyjny progu**: trzy przypadki US-02, wszystkie startujące z `solvedComposition()`
  i idące przez `JSON.stringify`. Zero zahardkodowanych identyfikatorów — perk wybierany przez
  lookup `competencyOfPerk`, zastępca **znajdowany** przez przeszukanie puli z `throw`, gdy nikt
  nie domyka progu. Faza 1 nie dotknęła pliku testowego.
- **Sygnatura `updateTeam`**: `input.id` ma typ `string | undefined`, gdzie faza 1 planu pisała
  `string`. To rozstrzygnięcie **sprzeczności wewnątrz samego planu** — faza 2 wymagała, by
  `context.params.id` szedł do repo bez zawężania, co przy `id: string` nie skompilowałoby się.
  Implementacja wybrała wersję zgodną z fazą 2 i z sąsiednimi `getTeamSummary`/`getTeamDetail`.
  Wada planu, nie implementacji; intencja zachowana.
- **`plan.md` w commitach implementacyjnych** zmieniał wyłącznie pola wyboru w `## Progress` —
  umowa nie została przepisana pod implementację. `roadmap.md` ma S-05 w `in-progress`, co jest
  poprawne: przejście na `done` należy do `/10x-archive` (precedens: `78a97e3` dla S-04).
