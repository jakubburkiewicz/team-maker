# Plan implementacji: lista drużyn na stronie głównej zamiast dashboardu i osobnej trasy `/teams`

## Przegląd

Treść listy drużyn przenosi się z `/teams` na `/`. Znikają trzy pliki — `src/pages/dashboard.astro`,
`src/pages/teams/index.astro` i osierocony przez tę zmianę `src/components/Welcome.astro` — a wraz
z nimi dwie trasy: `/dashboard` i `/teams` (indeks listy). Podtrasy `/teams/new`, `/teams/[id]`
i `/teams/[id]/embark` zostają bez zmian w adresach.

Ochrona `/` nie może być dopisana do dzisiejszej listy `PROTECTED_ROUTES`, bo dopasowanie działa
przez `startsWith` — wpis `"/"` złapałby również `/auth/signin` i dałby pętlę przekierowań. Reguła
przenosi się więc do czystego modułu `src/lib/routes.ts` pokrytego testem.

Punkty 3, 4 i 5 z listy zmian zgłoszonych przez użytkownika.

## Analiza stanu obecnego

`src/pages/index.astro` ma osiem linii i renderuje wyłącznie `<Welcome />` — stronę startową
szablonu 10x Astro Starter z hasłem „A production-ready starter…", trzema kartami funkcji
i przyciskami `Sign In` / `Sign Up`. Nie ma nic wspólnego z produktem.

`src/pages/teams/index.astro` to gotowy widok listy: frontmatter czyta `listTeams`, rozróżnia
`null` (awaria odczytu) od `[]` (nowe konto), formatuje daty przez `Intl.DateTimeFormat` **przy
odczycie** (bo `format` na `Invalid Date` rzuca `RangeError`, a w szablonie taki wyjątek jest poza
`try` i wywróciłby render), oraz obsługuje baner `?deleted=1`. Szablon ma trzy gałęzie: karta
awarii, stan pusty z wezwaniem do utworzenia pierwszej drużyny, lista pozycji.

`src/pages/dashboard.astro` jest przykładową stroną chronioną z szablonu startera: e-mail
użytkownika, dwa linki (`/teams/new`, `/teams`) i formularz wylogowania.

`src/middleware.ts:4` trzyma `PROTECTED_ROUTES = ["/dashboard", "/teams", "/api/teams"]`,
a `:20` dopasowuje je przez `context.url.pathname.startsWith(route)`.

Trzynaście odwołań do `/dashboard` lub `/teams` żyje w sześciu plikach — poza dwoma usuwanymi
stronami są to `src/middleware.ts:4`, `src/components/Topbar.astro:13`,
`src/components/team/TeamNotFound.astro:31,34`, `src/pages/teams/new.astro:40,57`,
`src/pages/teams/[id].astro:115,146`, `src/pages/teams/[id]/embark.astro:77,83,93`.
Do tego `src/pages/api/teams/[id]/delete.ts:75` przekierowuje po usunięciu na `/teams?deleted=1`,
a `README.md:144` dokumentuje `/dashboard` w tabeli tras.

`src/pages/api/auth/signin.ts:20` już dziś przekierowuje po zalogowaniu na `/`, więc po tej
zmianie gracz ląduje wprost na swojej liście — bez żadnej edycji tej trasy.

## Pożądany stan końcowy

Zalogowany gracz otwiera `/` i widzi listę własnych drużyn — tę samą, co dziś pod `/teams`, co do
treści, układu i zachowania trzech gałęzi. `/dashboard` i `/teams` zwracają 404 Astro (brak trasy).
Niezalogowany odwiedzający `/` trafia na `/auth/signin`. Usunięcie drużyny wraca na `/?deleted=1`
z banerem „Team deleted.". Żadna strona nie linkuje już do `/dashboard` ani `/teams`.

Weryfikacja: `npm test`, `npm run lint`, `npm run build` przechodzą; strażniki grepowe z Fazy 3 są
puste; pętla CRUD (utworzenie, podgląd, edycja, usunięcie) przechodzi ręcznie od `/`.

Po tej zmianie spełniona jest bramka wstępna planu `2026-09-06-app-shell-header-nav`
(`plan.md:176`): `! test -e src/components/Welcome.astro && ! test -e src/pages/dashboard.astro &&
! test -e src/pages/teams/index.astro && grep -qF "listTeams" src/pages/index.astro`.

### Kluczowe odkrycia:

- **Pułapka dopasowania `/`.** `src/middleware.ts:20` używa `startsWith`, więc wpis `"/"`
  w `PROTECTED_ROUTES` byłby prefiksem każdej ścieżki, w tym `/auth/signin` — niezalogowany
  odbijałby na logowanie, które samo odbijałoby na logowanie. Awaria cicha: lint, typy i build
  przechodzą, wywraca się dopiero przeglądarka.
- **Test wymaga wydzielenia modułu.** `src/middleware.ts:1` importuje `astro:middleware`, a AGENTS.md
  zabrania, by cokolwiek pod testem importowało `astro:*`. Reguła musi zamieszkać w czystym
  `src/lib/routes.ts`, żeby dała się związać asercją — ten sam wzór, którym `2026-09-06-app-shell-header-nav`
  wydziela `src/lib/nav.ts`.
- **Formatowanie daty przy odczycie jest umowne, nie kosmetyczne.**
  `src/pages/teams/index.astro:26-45` — `Intl.DateTimeFormat.format` rzuca `RangeError` na
  `Invalid Date`; wywołanie w szablonie byłoby poza `try` i dałoby 500 w Workerze. Przenosiny muszą
  zachować kolejność: formatowanie w `try`, gotowy `string` do szablonu.
- **Rozróżnienie `null` vs `[]` niesie dwa różne ekrany.** `src/pages/teams/index.astro:20-24` —
  `listTeams` celowo nie rzuca przy zerze wierszy. Sklejenie obu wartości zamieniłoby stan pusty
  (FR-005, US-01: „wyjaśnienie i wezwanie", nie zero wyników) w kartę awarii.
- **Grep na `href="/teams"` nie trafia w `href="/teams/new"`** (zweryfikowane 2026-09-06: pięć
  trafień, wszystkie dokładne) ani w polskie komentarze mówiące o `/teams`
  (`src/lib/team-repo.ts:31`, `src/pages/teams/[id]/embark.astro:8`) — te nie mają `href=`.
  Kotwica na atrybucie spełnia lekcję „Kryteria grepowe kotwicz na składni, nie na słowach".
- **`src/components/ui/LibBadge.astro` jest osierocony już dziś**, niezależnie od tej zmiany —
  poza zakresem (patrz „Czego NIE robimy").

## Czego NIE robimy

- **Nie usuwamy `src/components/Topbar.astro`.** Po skasowaniu `Welcome.astro` zostaje osierocony,
  ale jego kasację jawnie deklaruje `2026-09-06-app-shell-header-nav` §Faza 2. Dublowanie dałoby
  konflikt między dwoma planami.
- **Nie dodajemy nagłówka ani menu nawigacyjnego** — to zakres `2026-09-06-app-shell-header-nav`.
  Ta zmiana jest jego wymaganiem wstępnym, nie jego częścią.
- **Nie usuwamy linków powrotnych, tylko je przekierowujemy** na `/`. Usunięcie zostawiłoby cztery
  ekrany bez żadnej nawigacji do czasu wdrożenia nagłówka; kasację zrobi zmiana siostrzana.
- **Nie zmieniamy przycisków na pozycjach listy** („Embark", „Edit", „Delete" jako ikony) — zakres
  `2026-09-06-team-action-buttons`.
- **Nie usuwamy przycisku „Assemble a new team"** z gałęzi niepustej ani CTA ze stanu pustego, mimo
  że po wdrożeniu nagłówka powstanie duplikat wejścia do `/teams/new`. Decyzja należy do zmian
  siostrzanych; tutaj treść przenosi się dosłownie.
- **Nie zmieniamy `src/pages/api/auth/signout.ts`.** Trasa dalej celuje w `/`, a przekierowanie na
  logowanie robi middleware — jedno źródło reguły „niezalogowany → logowanie". Ceną jest jedno
  dodatkowe 302 przy wylogowaniu.
- **Nie zmieniamy `src/pages/api/auth/signin.ts`** — już dziś celuje w `/`.
- **Nie wydzielamy komponentu listy** (`TeamsList.astro`). Treść przenosi się dosłownie, żeby diff
  czytał się jako przenosiny.
- **Nie ruszamy `src/components/ui/LibBadge.astro`** ani innych osieroconych wcześniej plików.
- **Nie zmieniamy schematu bazy, migracji, polityk RLS ani `src/lib/team-repo.ts`.**

## Podejście do implementacji

Trzy fazy w kolejności „najpierw logika, potem podłączenie, na końcu odwołania".

Faza 1 tworzy `src/lib/routes.ts` i jego test, nie podłączając niczego — jedyna cicha pułapka
zmiany zostaje związana asercją, zanim cokolwiek zacznie od niej zależeć. Faza jest niewidoczna dla
użytkownika, więc nie ma bramki ręcznej.

Faza 2 jest jedną atomową operacją: `index.astro` przejmuje treść, `middleware.ts` przechodzi na
moduł, trzy pliki znikają, `delete.ts` celuje w nowy adres. Przed nią i po niej aplikacja działa;
w środku nie ma stanu pośredniego, w którym `/` jest chronione, a wciąż pokazuje stronę startową
szablonu.

Faza 3 sprząta odwołania w czterech stronach, których ta zmiana poza tym nie dotyka, oraz tabelę
tras w README. Wydzielona osobno, bo jest czysto mechaniczna i weryfikowalna grepem.

## Krytyczne szczegóły implementacji

**Sekwencjonowanie wewnątrz Fazy 2.** Kolejność ma znaczenie tylko w jedną stronę: `middleware.ts`
musi objąć `/` **w tym samym commicie**, w którym `index.astro` dostaje listę drużyn. Podłączenie
ochrony wcześniej zamknęłoby stronę startową szablonu przed niezalogowanym (stan przejściowy bez
wartości), podłączenie później otworzyłoby listę cudzych… a właściwie własnych drużyn dla żądania
bez sesji — `listTeams` bez zalogowanego użytkownika zwróci pustą listę przez RLS, więc nie ma
wycieku, ale niezalogowany zobaczyłby ekran „No crew on the books yet" zamiast logowania, czyli
naruszenie FR-004. Kasacja `dashboard.astro` musi iść razem z usunięciem `/dashboard`
z listy chronionych — inaczej trasa istnieje jako niechroniona lub lista pilnuje nieistniejącej
trasy.

## Faza 1: Moduł ochrony tras

### Przegląd

Reguła „które ścieżki wymagają zalogowania" przenosi się z tablicy w middleware do czystego modułu
z testem. Faza niczego nie podłącza — po niej `src/middleware.ts` jest nietknięty, a moduł ma zero
konsumentów.

### Wymagane zmiany:

#### 1. Moduł reguły

**Plik**: `src/lib/routes.ts`

**Cel**: Wyrazić ochronę tras tak, żeby dała się związać testem. Dziś reguła żyje w pliku
importującym `astro:middleware`, którego AGENTS.md zabrania wciągać pod test, więc pułapka
dopasowania `/` jest nietestowalna z definicji.

**Umowa**: Eksportuje `isProtectedRoute(pathname: string): boolean` — funkcję czystą, bez importów
z `astro:*` i bez `@/lib/supabase`. Rozróżnia dwa rodzaje wpisów:

- **dokładne** — `/` i tylko `/`; dopasowanie przez równość, nigdy przez prefiks;
- **prefiksowe** — `/teams` i `/api/teams`; dopasowanie po granicy segmentu, czyli
  `pathname === prefix || pathname.startsWith(prefix + "/")`.

Wpis `/dashboard` **nie występuje** — trasa znika w Fazie 2. Granica segmentu przy prefiksach jest
tańsza niż wyjaśnianie, dlaczego hipotetyczne `/teamsomething` byłoby chronione; kosztuje jedno
wyrażenie i domyka klasę tej samej pułapki, którą rozwiązuje tryb dokładny.

Fragment kontraktu dopasowania — bo to jest dokładnie ta jedna linia, której nieoczywistość jest
sednem całej fazy:

```ts
// `/` musi być dopasowane przez równość: `"/auth/signin".startsWith("/")` jest prawdą,
// więc prefiks dałby pętlę przekierowań na własnym ekranie logowania.
```

#### 2. Test reguły

**Plik**: `src/lib/routes.test.ts`

**Cel**: Związać asercjami pułapkę, która nie objawia się ani w lincie, ani w typach, ani
w buildzie — wyłącznie w przeglądarce, jako pętla przekierowań.

**Umowa**: Asercje wyrażone **literałami ścieżek**, nie odczytami ze stałych modułu (wzorzec
z `src/lib/missing-competencies.test.ts`: asercja przez pinowaną stałą podąża za jej mutacją
i przestaje cokolwiek wiązać). Pokrywa co najmniej:

- chronione: `/`, `/teams/new`, `/teams`, `/teams/8f3c…-uuid`, `/teams/8f3c…-uuid/embark`,
  `/api/teams`, `/api/teams/8f3c…-uuid/delete`;
- **nie**chronione: `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/api/auth/signin`,
  `/api/auth/signout` — to jest asercja pilnująca pułapki prefiksu `/`;
- `/dashboard` **nie**chronione — trasa nie istnieje, a wpis w module byłby martwy;
- `/teamsomething` niechronione — granica segmentu przy prefiksie.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Testy przechodzą: `npm test`
- Moduł jest czysty (nie wciąga Astro ani Supabase):
  `! grep -nE '^import .* from "(astro:|@/lib/supabase)' src/lib/routes.ts`
- Moduł nie zna usuwanych tras: `! grep -n '"/dashboard"' src/lib/routes.ts`
- Moduł nie dopasowuje `/` przez prefiks: `! grep -n 'startsWith("/")' src/lib/routes.ts`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja:

- Brak — faza nie zmienia niczego widocznego dla użytkownika.

**Uwaga implementacyjna**: Faza nie ma weryfikacji ręcznej; po zielonych kryteriach automatycznych
przejdź od razu do Fazy 2. Bloki faz używają zwykłych punktorów — odpowiadające im pola wyboru
`- [ ]` znajdują się w sekcji `## Progress` na dole planu.

---

## Faza 2: Przenosiny listy na stronę główną

### Przegląd

Jedna atomowa operacja: `/` staje się listą drużyn i trasą chronioną, `/dashboard` i `/teams`
przestają istnieć, przekierowanie po usunięciu celuje w nowy adres. Aplikacja działa przed fazą
i po niej.

### Wymagane zmiany:

#### 1. Strona główna przejmuje listę

**Plik**: `src/pages/index.astro`

**Cel**: `/` pokazuje listę własnych drużyn zamiast strony startowej szablonu (punkt 3 zgłoszenia).

**Umowa**: Zawartość `src/pages/teams/index.astro` — cały frontmatter i cały szablon — przeniesiona
**dosłownie**, z trzema kategoriami zmian i żadną inną:

1. `href="/dashboard"` w nagłówku (`:59`) i w karcie awarii (`:69`) → usunięte wraz z linkiem
   „← Back to dashboard" i przyciskiem „Back to dashboard". Nagłówek zostaje jako sam `<h1>`;
   karta awarii traci przycisk. Tu, w przeciwieństwie do czterech stron z Fazy 3, kasujemy zamiast
   przekierowywać: link ze strony głównej na stronę główną nie ma sensu.
2. Komentarze mówiące o trasie: `:7` („Trasa mieści się w prefiksie `/teams`
   z `PROTECTED_ROUTES`…") i `:13` („`POST /api/teams/[id]/delete` wraca tu z `?deleted=1`") oraz
   log `"Failed to list teams for /teams"` (`:48`) → zaktualizowane do `/`.
3. Import `Welcome` i jego użycie → zastąpione importami z przenoszonego frontmatteru.

**Musi zostać nietknięte**: rozróżnienie `null` (awaria) od `[]` (nowe konto) wraz z oboma ekranami;
formatowanie daty przez `savedAtFormat` **wewnątrz `try`**, nie w szablonie; gałąź `!supabase` jako
obrona w głąb; położenie banera `?deleted=1` nad obiema gałęziami udanego odczytu i nigdy nad
gałęzią awarii; `<Layout title="Your teams">`; `max-w-3xl`; zero dyrektyw `client:*`; oba wejścia do
`/teams/new` (przycisk przy niepustej liście i CTA w stanie pustym).

#### 2. Middleware przechodzi na moduł

**Plik**: `src/middleware.ts`

**Cel**: `/` staje się trasą chronioną, a `/dashboard` przestaje nią być, bo przestaje istnieć.

**Umowa**: Tablica `PROTECTED_ROUTES` i wyrażenie `.some((route) => …startsWith(route))` znikają;
warunek staje się wywołaniem `isProtectedRoute(context.url.pathname)` z `@/lib/routes`. Reszta pliku
— tworzenie klienta, wypełnianie `context.locals.user` przy **każdym** żądaniu, cel przekierowania
`/auth/signin` — bez zmian.

#### 3. Kasacja trzech plików

**Pliki**: `src/pages/dashboard.astro`, `src/pages/teams/index.astro`, `src/components/Welcome.astro`

**Cel**: Usunąć trasy `/dashboard` i `/teams` (punkty 4 i 5 zgłoszenia) oraz stronę startową
szablonu, która po punkcie 3 nie ma gdzie żyć.

**Umowa**: Kasacja plików. `Welcome.astro` traci jedynego konsumenta w kroku 1 tej fazy;
`Topbar.astro`, który `Welcome.astro` importuje, **zostaje** — kasuje go
`2026-09-06-app-shell-header-nav` §Faza 2. Po kasacji `Topbar.astro` jest osierocony i to jest stan
oczekiwany, nie usterka.

#### 4. Przekierowanie po usunięciu drużyny

**Plik**: `src/pages/api/teams/[id]/delete.ts`

**Cel**: Potwierdzenie usunięcia musi trafić na listę, a lista jest teraz pod `/`.

**Umowa**: `context.redirect("/teams?deleted=1")` (`:75`) → `context.redirect("/?deleted=1")`.
Komentarz nad linią, który mówi „Potwierdzenie musi trafić na listę", zostaje aktualny — zmienia
się w nim tylko adres. Parametr `deleted=1` i jego odczyt przez `Astro.url.searchParams.has`
bez zmian.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Pliki nie istnieją:
  `! test -e src/pages/dashboard.astro && ! test -e src/pages/teams/index.astro && ! test -e src/components/Welcome.astro`
- Strona główna czyta listę: `grep -qF "listTeams" src/pages/index.astro`
- Strona główna nie hydratuje niczego: `! grep -nE 'client:[a-z]+' src/pages/index.astro`
- Middleware nie trzyma już własnej listy:
  `! grep -n "PROTECTED_ROUTES" src/middleware.ts && grep -qF "isProtectedRoute" src/middleware.ts`
- Przekierowanie po usunięciu celuje w `/`:
  `grep -qF 'redirect("/?deleted=1")' src/pages/api/teams/\[id\]/delete.ts`
- Testy przechodzą: `npm test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja:

- Zalogowany gracz otwiera `/` i widzi swoją listę drużyn; pozycje prowadzą do `/teams/[id]`.
- Niezalogowany otwiera `/` i ląduje na `/auth/signin` — **bez pętli**: formularz logowania
  renderuje się, adres zostaje na `/auth/signin`.
- Zalogowanie przez formularz kończy się na `/` z listą (`signin.ts` już celuje w `/`).
- Wylogowanie kończy się na ekranie logowania (przez jedno dodatkowe przekierowanie z `/`).
- Konto bez żadnej drużyny widzi na `/` stan pusty „No crew on the books yet" z CTA, nie kartę
  awarii i nie zero wyników.
- Usunięcie drużyny wraca na `/` z banerem „Team deleted."; usunięcie **ostatniej** drużyny pokazuje
  baner nad stanem pustym.
- `/dashboard` i `/teams` zwracają 404.

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu wszystkich automatycznych
weryfikacji, zatrzymaj się tutaj w celu ręcznego potwierdzenia przez człowieka, że testy ręczne
zakończyły się sukcesem, zanim przejdziesz do Fazy 3. Ta faza jest jedyną, która zmienia zachowanie
uwierzytelniania — pętla przekierowań objawia się wyłącznie w przeglądarce.

---

## Faza 3: Odwołania do usuniętych tras

### Przegląd

Cztery strony i jeden plik dokumentacji wskazują na `/dashboard` lub `/teams`. Faza jest czysto
mechaniczna i w całości weryfikowalna grepem.

### Wymagane zmiany:

#### 1. Linki powrotne w stronach domenowych

**Pliki**: `src/pages/teams/new.astro` (`:40`, `:57`), `src/pages/teams/[id].astro` (`:115`, `:146`),
`src/pages/teams/[id]/embark.astro` (`:77`, `:83`, `:93`),
`src/components/team/TeamNotFound.astro` (`:31`, `:34`)

**Cel**: Żaden link nie może prowadzić w 404 po usunięciu obu tras. Przekierowanie, nie kasacja —
do czasu wdrożenia `2026-09-06-app-shell-header-nav` te linki są jedyną nawigacją na tych ekranach.

**Umowa**: Każde `href="/dashboard"` i `href="/teams"` → `href="/"`. Etykieta ujednolicona do
**„Your teams"** (z wariantem „← Your teams" tam, gdzie dziś jest strzałka, i „Back to your teams"
na przyciskach w kartach awarii). Tam, gdzie po zmianie powstałby **duplikat** — a powstaje
w trzech miejscach, bo każdy z tych plików ma dziś osobny link „Your teams" i osobny „Back to
dashboard" (`TeamNotFound.astro:31,34`, `embark.astro:77,83`) albo dwa linki w różnych gałęziach
(`[id].astro:115,146`) — zostaje **jeden** link w danym bloku:

- `TeamNotFound.astro` — dwa linki w jednym `<div>` scalają się w jeden „Your teams".
- `embark.astro` — w karcie sukcesu (`:77,80,83`) zostają trzy pozycje: „View this team",
  „Your teams", „Assemble another team"; „Back to dashboard" (`:83`) znika jako duplikat drugiej.
  W karcie awarii (`:93`) przycisk celuje w `/` z etykietą „Back to your teams".
- `new.astro` — `:40` staje się „← Your teams", `:57` „Back to your teams"; to różne gałęzie, więc
  oba zostają.
- `[id].astro` — `:115` i `:146` są w różnych gałęziach, oba zostają, oba celują w `/`.

Nie zmieniamy klas Tailwind, struktury ani niczego poza `href` i tekstem etykiety. Wszystkie te
linki znikają w `2026-09-06-app-shell-header-nav` §Faza 3 — nie inwestuj w ich wygląd.

#### 2. Tabela tras w dokumentacji

**Plik**: `README.md` (`:144`)

**Cel**: Dokumentacja przestaje opisywać nieistniejącą trasę.

**Umowa**: Wiersz `| \`/dashboard\` | Example protected page … |` zastąpiony wierszem o `/` jako
chronionej stronie z listą drużyn. Zdanie pod tabelą o `PROTECTED_ROUTES` w `src/middleware.ts`
wskazuje teraz `src/lib/routes.ts`. Reszta README bez zmian — pozostałe wystąpienia słowa
„dashboard" (`:119`, `:120`, `:131`, `:164`) dotyczą panelu Supabase i Cloudflare, nie trasy.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Brak odwołań do usuniętych tras w kodzie:
  `! grep -rn 'href="/dashboard"' src/ && ! grep -rn 'href="/teams"' src/`
  (kotwica na atrybucie: `href="/teams/new"` nie pasuje, a polskie komentarze o `/teams`
  w `src/lib/team-repo.ts:31` i `src/pages/teams/[id]/embark.astro:8` nie mają `href=`)
- README nie dokumentuje usuniętej trasy: `! grep -n '^| \`/dashboard\`' README.md`
- Testy przechodzą: `npm test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`
- Bramka dla zmiany siostrzanej jest zielona:
  `! test -e src/components/Welcome.astro && ! test -e src/pages/dashboard.astro && ! test -e src/pages/teams/index.astro && grep -qF "listTeams" src/pages/index.astro`

#### Ręczna weryfikacja:

- Z `/teams/new` link powrotny prowadzi na `/`.
- Z `/teams/[id]` link powrotny prowadzi na `/`.
- Z `/teams/[id]/embark` (po zapisaniu drużyny) wszystkie linki prowadzą do istniejących ekranów.
- Cudze lub nieistniejące id daje ekran „Team not found" z działającym linkiem na `/`, dalej
  ze statusem 404 i identyczną treścią dla `/teams/[id]` i `/teams/[id]/embark`.
- Wyłączenie kluczy Supabase (`.env`) pokazuje karty awarii z działającymi przyciskami — to jedyny
  sposób, żeby zobaczyć gałęzie `:57`, `:93`, `:146`.

**Uwaga implementacyjna**: Po zielonych kryteriach automatycznych zatrzymaj się na ręczne
potwierdzenie. Gałęzie awarii nie są osiągalne z działającą konfiguracją — bez zdjęcia kluczy
połowa zmienionych linków pozostaje nieprzetestowana.

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/routes.test.ts` — jedyny nowy test zmiany. Wiąże regułę ochrony tras literałami ścieżek:
  `/` chronione, `/auth/*` i `/api/auth/*` nie, prefiksy `/teams` i `/api/teams` po granicy segmentu,
  `/dashboard` niechronione.
- Bez nowych testów poza tym. Reszta zmiany to przenosiny szablonu `.astro` i edycje `href`, których
  AGENTS.md nie pozwala pokryć testem (nic pod testem nie może importować `astro:*`).

### Testy integracyjne:

- Brak. AGENTS.md zabrania bootstrapować Astro w testach; integracja jest weryfikowana przez
  `npm run build` plus kroki ręczne poniżej.

### Kroki testowania ręcznego:

1. Wyloguj się i otwórz `/` — musi pokazać formularz logowania pod adresem `/auth/signin`, bez
   pętli przekierowań (sprawdź, że przeglądarka nie zgłasza `ERR_TOO_MANY_REDIRECTS`).
2. Otwórz bezpośrednio `/auth/signup` i `/auth/confirm-email` bez sesji — muszą się wyrenderować.
3. Zaloguj się — musisz wylądować na `/` z listą drużyn.
4. Na koncie bez drużyn: `/` pokazuje „No crew on the books yet" z CTA „Assemble your first team".
5. Utwórz drużynę przez `/teams/new`, zapisz, przejdź przez `embark`, wróć na `/` — drużyna jest na
   liście z datą zapisu.
6. Otwórz drużynę, zmień skład, zapisz — baner „Roster saved.", link powrotny prowadzi na `/`.
7. Usuń drużynę — powrót na `/?deleted=1` z banerem „Team deleted.".
8. Usuń **ostatnią** drużynę — baner nad stanem pustym, nie nad kartą awarii.
9. Otwórz `/dashboard` i `/teams` — obie muszą dać 404.
10. Otwórz `/teams/<losowy-uuid>` i `/teams/<losowy-uuid>/embark` — identyczny ekran „Team not found",
    status 404, link na `/`.
11. Wyloguj się — ekran logowania.
12. Zdejmij `SUPABASE_URL` i `SUPABASE_KEY` z `.env`, zrestartuj `npm run dev`, otwórz `/teams/new`
    i `/teams/<uuid>` — karty awarii z przyciskami celującymi w `/`. Przywróć klucze.

## Uwagi dotyczące wydajności

Brak implikacji. `isProtectedRoute` to kilka porównań stringów na żądanie, w miejscu, gdzie dziś
działa `Array.prototype.some` po trzech elementach. Wylogowanie kosztuje jedno dodatkowe
przekierowanie 302 (`/` → `/auth/signin`) — przyjęte świadomie, żeby reguła „niezalogowany →
logowanie" miała jedno źródło w middleware.

## Uwagi dotyczące migracji

Brak migracji danych. Zmieniają się adresy dwóch tras, ale PRD nie stawia wymagania o trwałości
adresów, a produkt nie ma zewnętrznych linków (persona główna wchodzi raz, przez stronę główną).
`@astrojs/sitemap` odbuduje mapę przy `npm run build` bez ingerencji.

Zmiana nie wymaga `supabase db push` ani żadnej operacji na hostowanym projekcie.

## Referencje

- Zgłoszenie i rozstrzygnięcia zakresu: `context/changes/2026-09-06-teams-list-as-home/change.md`
- Zmiana zależna (bramkuje się na tej): `context/changes/2026-09-06-app-shell-header-nav/plan.md`
  — szczególnie bramka wstępna w §Faza 1 „Kryteria sukcesu"
- Zmiana siostrzana: `context/changes/2026-09-06-team-action-buttons/change.md`
- Źródło przenoszonej treści: `src/pages/teams/index.astro`
- Pułapka dopasowania: `src/middleware.ts:4,20`
- Wzorzec czystego modułu z testem: `src/lib/missing-competencies.ts`,
  `src/lib/missing-competencies.test.ts`
- Lekcje: `context/foundation/lessons.md` — §„Kryteria grepowe kotwicz na składni, nie na słowach",
  §„W `.astro` nie planuj top-level `return`"
- Wymagania: `context/foundation/prd.md` — FR-004, FR-005, FR-010, US-01, §Access Control

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Odhaczaj `[x]` dopiero po **dosłownym uruchomieniu** komendy
> i zobaczeniu, że przechodzi — `[x]` nie znaczy „intencja spełniona".

### Faza 1: Moduł ochrony tras

#### Automatyczne

- [ ] 1.1 Testy przechodzą: `npm test`
- [ ] 1.2 Moduł jest czysty: `! grep -nE '^import .* from "(astro:|@/lib/supabase)' src/lib/routes.ts`
- [ ] 1.3 Moduł nie zna usuwanych tras: `! grep -n '"/dashboard"' src/lib/routes.ts`
- [ ] 1.4 Moduł nie dopasowuje `/` przez prefiks: `! grep -n 'startsWith("/")' src/lib/routes.ts`
- [ ] 1.5 Linting przechodzi: `npm run lint`
- [ ] 1.6 Build przechodzi: `npm run build`

### Faza 2: Przenosiny listy na stronę główną

#### Automatyczne

- [ ] 2.1 Pliki nie istnieją: `! test -e src/pages/dashboard.astro && ! test -e src/pages/teams/index.astro && ! test -e src/components/Welcome.astro`
- [ ] 2.2 Strona główna czyta listę: `grep -qF "listTeams" src/pages/index.astro`
- [ ] 2.3 Strona główna nie hydratuje niczego: `! grep -nE 'client:[a-z]+' src/pages/index.astro`
- [ ] 2.4 Middleware nie trzyma już własnej listy: `! grep -n "PROTECTED_ROUTES" src/middleware.ts && grep -qF "isProtectedRoute" src/middleware.ts`
- [ ] 2.5 Przekierowanie po usunięciu celuje w `/`: `grep -qF 'redirect("/?deleted=1")' src/pages/api/teams/\[id\]/delete.ts`
- [ ] 2.6 Testy przechodzą: `npm test`
- [ ] 2.7 Linting przechodzi: `npm run lint`
- [ ] 2.8 Build przechodzi: `npm run build`

#### Ręczne

- [ ] 2.9 Zalogowany widzi na `/` swoją listę drużyn, pozycje prowadzą do `/teams/[id]`
- [ ] 2.10 Niezalogowany na `/` ląduje na `/auth/signin` bez pętli przekierowań
- [ ] 2.11 Zalogowanie kończy się na `/` z listą
- [ ] 2.12 Wylogowanie kończy się na ekranie logowania
- [ ] 2.13 Konto bez drużyn widzi na `/` stan pusty z CTA, nie kartę awarii
- [ ] 2.14 Usunięcie drużyny wraca na `/` z banerem „Team deleted."; usunięcie ostatniej pokazuje baner nad stanem pustym
- [ ] 2.15 `/dashboard` i `/teams` zwracają 404

### Faza 3: Odwołania do usuniętych tras

#### Automatyczne

- [ ] 3.1 Brak odwołań w kodzie: `! grep -rn 'href="/dashboard"' src/ && ! grep -rn 'href="/teams"' src/`
- [ ] 3.2 README nie dokumentuje usuniętej trasy: ``! grep -n '^| `/dashboard`' README.md``
- [ ] 3.3 Testy przechodzą: `npm test`
- [ ] 3.4 Linting przechodzi: `npm run lint`
- [ ] 3.5 Build przechodzi: `npm run build`
- [ ] 3.6 Bramka dla zmiany siostrzanej jest zielona: `! test -e src/components/Welcome.astro && ! test -e src/pages/dashboard.astro && ! test -e src/pages/teams/index.astro && grep -qF "listTeams" src/pages/index.astro`

#### Ręczne

- [ ] 3.7 Link powrotny z `/teams/new` prowadzi na `/`
- [ ] 3.8 Link powrotny z `/teams/[id]` prowadzi na `/`
- [ ] 3.9 Wszystkie linki z `/teams/[id]/embark` prowadzą do istniejących ekranów
- [ ] 3.10 Ekran „Team not found" (404, identyczny dla obu tras) ma działający link na `/`
- [ ] 3.11 Karty awarii przy zdjętych kluczach Supabase mają przyciski celujące w `/`
