# Plan implementacji: Wspólny nagłówek z użytkownikiem i menu nawigacyjnym na każdej stronie

## Przegląd

Każda strona aplikacji dostaje wspólną powłokę z nagłówkiem: e-mail zalogowanego gracza po lewej,
menu `Your teams` / `New team` / `Sign out` po prawej. Nawigacja między widokami przenosi się
z trzynastu rozsypanych po stronach linków do jednego komponentu, a per-stronowe linki powrotne
(„← Back to dashboard", „← Your teams", przyciski wyjścia w gałęziach awarii) znikają.

Realizuje punkty 1 i 2 z listy zmian zgłoszonych przez użytkownika
(`context/changes/2026-09-06-app-shell-header-nav/change.md`).

## Analiza stanu obecnego

Nagłówek istnieje — `src/components/Topbar.astro` — i renderuje dokładnie to, o co prosi punkt 2:
`user.email`, linki nawigacyjne i `Sign out` jako `<form method="POST" action="/api/auth/signout">`.
Jest jednak montowany w **jednym** miejscu: `src/components/Welcome.astro:28`, czyli wyłącznie na
stronie startowej. Żadna strona domenowa go nie widzi.

`src/layouts/Layout.astro` ma każda strona, ale jest czystą powłoką HTML — `<head>`, baner
`missingConfigs`, `<slot />`. Nie zna sesji ani nawigacji.

Zamiast nagłówka strony domenowe mają **własne, powtórzone nagłówki**: `<h1>` obok linku
„← Back to dashboard" albo „← Your teams", plus drugi zestaw tych samych linków w gałęziach awarii
i pustej listy. `src/components/team/TeamNotFound.astro` renderuje własny `Layout` i własną parę
linków wyjścia.

Kluczowe ograniczenie zewnętrzne: obie trasy, do których te linki celują — `/dashboard` i `/teams`
— **znikają** w zmianie `2026-09-06-teams-list-as-home`. Ta zmiana jest wymaganiem wstępnym
niniejszego planu (rozstrzygnięte w sesji planowania), więc plan opisuje pliki w stanie **po** niej.

**Bramka.** W chwili pisania tego planu wymaganie wstępne ma `status: new` i nie ma jeszcze
`plan.md`. Kryterium 1.1 Fazy 1 sprawdza jego wdrożenie mechanicznie. Gdy jest czerwone — przerwij
implementację i wykonaj najpierw `2026-09-06-teams-list-as-home`; bez niego Faza 2 pkt 4 wywraca
`npm run build` (`src/components/Welcome.astro:2` wciąż importuje `Topbar.astro`), Faza 3 pkt 1
opisuje treść, której w `src/pages/index.astro` nie ma, `/` niesie dwa nagłówki naraz
(`AppHeader` z powłoki i `Topbar` w `Welcome.astro:28`), a `src/pages/dashboard.astro`
i `src/pages/teams/index.astro` zostają konsumentami `Layout.astro` poza oboma koszykami planu.

### Kluczowe odkrycia:

- `src/middleware.ts:13` ustawia `context.locals.user` przy **każdym** żądaniu, nie tylko na trasach
  chronionych. Nagłówek w powłoce ma więc dane wszędzie, bez żadnej zmiany w middleware.
- `src/components/Topbar.astro` ma jedynego konsumenta w `src/components/Welcome.astro:28`, a ten
  plik jest usuwany przez `2026-09-06-teams-list-as-home`. Po wymaganiu wstępnym `Topbar.astro`
  jest już osierocony — a osieroconego komponentu `.astro` nie łapie ani lint, ani typy.
- Trzynaście odwołań do `/dashboard` lub `/teams` w sześciu plikach: `src/middleware.ts:4`,
  `src/components/Topbar.astro:13`, `src/components/team/TeamNotFound.astro:31,34`,
  `src/pages/dashboard.astro:25`, `src/pages/teams/index.astro:59,69`,
  `src/pages/teams/[id].astro:115,146`, `src/pages/teams/new.astro:40,57`,
  `src/pages/teams/[id]/embark.astro:77,83,93`. Część znika wraz z plikami w wymaganiu wstępnym;
  reszta jest zakresem Fazy 3.
- `src/components/team/TeamNotFound.astro:8` **celowo nie ma propsów** (S-07): każdy prop byłby
  miejscem, w którym odpowiedzi `/teams/[id]` i `/teams/[id]/embark` na to samo cudze id mogłyby się
  rozjechać, a różnica w odpowiedzi jest wyciekiem. Przełączenie go na powłokę musi tę własność
  zachować.
- `AGENTS.md` → testy są czyste: nic pod testem nie może importować `astro:*` ani `@/lib/supabase`.
  Logika aktywnej pozycji menu musi więc mieszkać w `src/lib/`, żeby dała się przetestować.
- `astro.config.mjs` nie ustawia `trailingSlash`, więc do dopasowania ścieżki może przyjść zarówno
  `/teams/new`, jak i `/teams/new/`.
- `context/foundation/roadmap.md` nie zawiera pozycji o Change ID `2026-09-06-app-shell-header-nav`
  — i **tak ma zostać**. Kamień milowy M-1 jest zamknięty: wszystkie fragmenty S-01…S-08 mają
  `Status: done`. Ta zmiana i dwie siostrzane (`2026-09-06-teams-list-as-home`,
  `2026-09-06-team-action-buttons`) są poprawkami po kamieniu milowym, zgłoszonymi bezpośrednio
  przez użytkownika, i celowo nie mają pozycji w roadmapie. Nie jest to pominięta synchronizacja
  do nadrobienia; gdyby miały wejść do planu produktu, właściwym krokiem jest otwarcie M-2 przez
  `/10x-roadmap`, a nie dopisanie wiersza do zamkniętego kamienia milowego.

## Pożądany stan końcowy

Zalogowany gracz widzi ten sam pasek na `/`, `/teams/new`, `/teams/[id]`, `/teams/[id]/embark`
i na ekranie „Team not found": swój e-mail po lewej, po prawej `Your teams` → `/`,
`New team` → `/teams/new` oraz `Sign out`. Pozycja odpowiadająca bieżącemu widokowi jest wyróżniona
i niesie `aria-current="page"`. Żadna strona nie ma już własnego linku nawigacyjnego — ani obok
`<h1>`, ani w gałęzi awarii. Ekrany `/auth/*` zostają bez nagłówka.

Weryfikacja: `npm test` pokrywa regułę aktywnej ścieżki; strażniki grepowe potwierdzają, że w `src/`
nie ma odwołania `href="/dashboard"` ani `href="/teams"`, że `Topbar.astro` nie istnieje i że żadna
strona domenowa nie importuje już `Layout.astro` bezpośrednio.

## Czego NIE robimy

- **Nie ruszamy `src/layouts/Layout.astro`.** Zostaje czystą powłoką HTML z banerem konfiguracji;
  `/auth/*` używa go dalej bez zmian.
- **Nie dodajemy nagłówka na `/auth/signin`, `/auth/signup`, `/auth/confirm-email`.**
- **Nie usuwamy gałęzi „Not signed in"** przez przeniesienie jej do nowego nagłówka — nowy nagłówek
  jej nie ma; strony w powłoce są chronione przez middleware.
- **Nie zmieniamy `src/middleware.ts`.** `PROTECTED_ROUTES` jest zakresem
  `2026-09-06-teams-list-as-home`.
- **Nie zmieniamy trasy `POST /api/auth/signout`** ani jej przekierowania na `/`.
- **Nie ruszamy ikonowych akcji na liście drużyn ani układu akcji w edytorze** — to zakres
  `2026-09-06-team-action-buttons`.
- **Nie dodajemy responsywności ani menu mobilnego** — PRD → Non-Goals wyklucza gwarancję dla
  urządzeń mobilnych.
- **Nie usuwamy `src/pages/dashboard.astro`, `src/pages/teams/index.astro` ani
  `src/components/Welcome.astro`** — robi to wymaganie wstępne.

## Podejście do implementacji

Powłoka powstaje jako **osobny layout nad istniejącym**, nie jako warunek wewnątrz `Layout.astro`.
Przynależność strony do powłoki jest wtedy widoczna w jej imporcie — nie trzeba jej wnioskować
z warunku ukrytego w środku layoutu, a `Layout.astro` zostaje czystą powłoką HTML dla `/auth/*`.
Powłoka nie ma propsa włączającego nagłówek: prop byłby dokładnie tym cichym przełącznikiem, przed
którym ostrzega `context/foundation/lessons.md` („Wyspa bez `client:*` i flaga trybu odczytu to
jedna zmiana, nie dwie") — nowa strona zapomniałaby go podać i po prostu nie miałaby nagłówka,
czego nie złapie ani lint, ani typy. Wybór layoutu jest jedynym przełącznikiem.

Jedyna logika tej zmiany — która pozycja menu jest aktywna — trafia do czystego modułu w `src/lib/`,
bo tylko tak da się ją przetestować (`AGENTS.md`: nic pod testem nie importuje `astro:*`).
`.astro` zostaje wtedy samym markupem.

Kolejność faz idzie od najbardziej testowalnego do najszerszego: najpierw moduł z testem, potem
powłoka z jednym, najmniejszym konsumentem (`TeamNotFound` — bez `<h1>`, bez gałęzi, bez wysp), na
końcu migracja czterech stron domenowych wraz z wycięciem linków powrotnych.

## Krytyczne szczegóły implementacji

**Sekwencjonowanie stanu — pułapka dopasowania `/`.** Menu „Your teams" celuje w `/`. Naiwne
dopasowanie prefiksowe (`pathname.startsWith(href)`) uczyni tę pozycję aktywną na **każdej** stronie,
bo każda ścieżka zaczyna się od `/`. To ta sama pułapka, którą `change.md` zmiany
`2026-09-06-teams-list-as-home` odnotowuje przy `PROTECTED_ROUTES`. Dlatego pozycja niesie własny
tryb dopasowania, a nie jeden wspólny algorytm.

## Faza 1: Czysty moduł nawigacji

### Przegląd

Pozycje menu i reguła aktywnej ścieżki lądują w `src/lib/` jako czysty moduł pokryty Vitestem.
Faza nie zmienia niczego widocznego — jej wynikiem jest testowalna reguła, z której korzysta Faza 2.

### Wymagane zmiany:

#### 1. Moduł nawigacji powłoki

**Plik**: `src/lib/nav.ts`

**Cel**: Jedno źródło pozycji menu i jedyne miejsce, w którym mieszka reguła „która pozycja
odpowiada bieżącej ścieżce". Moduł jest czysty — zero importów `astro:*` i `@/lib/supabase` —
żeby dał się objąć testem zgodnie z twardą regułą z `AGENTS.md`.

**Umowa**: Eksportuje typ pozycji z polami `label`, `href` i trybem dopasowania (`"exact"` dla `/`,
`"prefix"` dla reszty), stałą listę pozycji w kolejności `Your teams` (`/`) → `New team`
(`/teams/new`), oraz predykat `(item, pathname) => boolean`.

`Sign out` **nie jest** pozycją tej listy: to `<form method="POST" action="/api/auth/signout">`,
nie link, więc nie ma `href` do dopasowania i nie może nigdy być „aktywny". Żyje w markupie
nagłówka (Faza 2).

Predykat normalizuje końcowy ukośnik przed porównaniem (`astro.config.mjs` nie ustawia
`trailingSlash`, więc przyjdzie i `/teams/new`, i `/teams/new/`), a tryb `"prefix"` dopasowuje
**po granicy segmentu** — `pathname === href || pathname.startsWith(href + "/")` — inaczej
hipotetyczne `/teams/newton` podświetliłoby „New team".

#### 2. Test reguły nawigacji

**Plik**: `src/lib/nav.test.ts`

**Cel**: Związać regułę aktywnej ścieżki asercjami na ścieżkach, które aplikacja realnie serwuje,
ze szczególnym naciskiem na pułapkę dopasowania `/`.

**Umowa**: Pokrywa co najmniej: `/` → aktywne wyłącznie „Your teams"; `/teams/new` → aktywne
wyłącznie „New team" (**nie** „Your teams" — to jest asercja pilnująca pułapki prefiksu);
`/teams/<uuid>` i `/teams/<uuid>/embark` → żadna pozycja nieaktywna; `/teams/new/` (końcowy
ukośnik) → tak samo jak bez niego; `/teams/newton` → „New team" nieaktywne. Osobno: lista pozycji
ma dokładnie dwa wpisy o `href` `/` i `/teams/new`, żaden nie celuje w `/dashboard` ani `/teams`.

Asercje wyrażaj literałami ścieżek, nie odczytami ze stałej listy — asercja wyrażona przez pinowaną
stałą podąża za jej mutacją i przestaje cokolwiek wiązać (wzorzec z `src/lib/missing-competencies.test.ts`).

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- **Wymaganie wstępne wdrożone** (bramka — czerwone znaczy „przerwij i wykonaj najpierw
  `2026-09-06-teams-list-as-home`", nie „napraw w tej zmianie"):
  `! test -e src/components/Welcome.astro && ! test -e src/pages/dashboard.astro && ! test -e src/pages/teams/index.astro && grep -qF "listTeams" src/pages/index.astro`
- Testy przechodzą: `npm test`
- Moduł jest czysty: `! grep -nE '^import .* from "(astro:|@/lib/supabase)' src/lib/nav.ts`
- Moduł nie zna usuwanych tras: `! grep -nE '"/(dashboard|teams)"' src/lib/nav.ts`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja:

- Brak — faza nie zmienia niczego widocznego dla użytkownika.

**Uwaga implementacyjna**: Faza nie ma weryfikacji ręcznej; po zielonych kryteriach automatycznych
przejdź od razu do Fazy 2.

---

## Faza 2: Powłoka i pierwszy konsument

### Przegląd

Powstaje nagłówek i layout powłoki. Pierwszym konsumentem jest `TeamNotFound.astro` — najmniejsza
strona w repo (bez `<h1>` sekcji, bez gałęzi, bez wysp React), więc awaria powłoki objawi się tam
bez szumu. Osierocony `Topbar.astro` znika.

### Wymagane zmiany:

#### 1. Nagłówek aplikacji

**Plik**: `src/components/AppHeader.astro`

**Cel**: Pasek nawigacyjny powłoki: tożsamość zalogowanego gracza po lewej, nawigacja i wylogowanie
po prawej. Zastępuje `Topbar.astro` w roli, którą tamten pełnił tylko na stronie startowej.

**Umowa**: Bez propsów — czyta `Astro.locals.user` (ustawiane przez `src/middleware.ts:13` przy
każdym żądaniu) oraz `Astro.url.pathname`, a pozycje i predykat bierze z `@/lib/nav`. Renderuje
`<header>` z `<nav>`; pozycje jako `<a>`, `Sign out` jako `<form method="POST"
action="/api/auth/signout">` z `<button type="submit">` — kształt i trasa dokładnie jak
w `src/components/Topbar.astro:19-23`, bo działają i `AGENTS.md` chroni ten kontrakt.

Aktywna pozycja dostaje `aria-current="page"` i wyróżnienie wizualne. Wyróżnienie składaj przez
`cn()` z `@/lib/utils` (`AGENTS.md` → Conventions: nie sklejaj łańcuchów klas).

**Nazwany kompromis:** `cn()` nie ma dziś w tym repo precedensu w `.astro` — wszystkie osiem
wywołań siedzi w `.tsx`, a każdy istniejący `.astro` używa literalnego `class="…"`. Astro ma na to
formę natywną (`class:list`) i `eslint.config.js:67` włącza `astro/prefer-class-list-directive`
właśnie w tę stronę. Wybieramy `cn()`, bo `AGENTS.md` mówi to wprost i bo reguła jest **warnem** —
`eslint .` nie kończy się błędem na warnach, więc `npm run lint` i CI zostają zielone. To decyzja,
nie przeoczenie: `/10x-impl-review` nie ma jej czytać jako dryfu.

`aria-current` jest bezpieczne wobec `flat/jsx-a11y-recommended`: `<a href={item.href}
aria-current={active ? "page" : undefined}>` przechodzi lint czysto (sprawdzone 2026-09-06
przez `eslint --stdin` na tym kształcie; precedens w tree: `src/layouts/Layout.astro:29`).

Gdy `Astro.locals.user` jest `null`, nagłówek nie renderuje e-maila ani menu (obrona w głąb —
wszystkie strony w powłoce są chronione przez middleware, więc ta gałąź jest nieosiągalna;
ten sam wzorzec co gałęzie `!supabase` w stronach domenowych). Nagłówek **nie** odtwarza gałęzi
„Not signed in" z `Topbar.astro:26-37` — `/auth/*` nie wchodzi do powłoki.

Paleta i kształt: przenieś klasy z `src/components/Topbar.astro:5-7`, żeby pasek wyglądał tak, jak
w punkcie 1 zgłoszenia („jak na aktualnej stronie głównej").

#### 2. Layout powłoki

**Plik**: `src/layouts/AppLayout.astro`

**Cel**: Powłoka stron domenowych — wspólne tło i nagłówek na każdej stronie, która z niej
korzysta. Sam wybór tego layoutu jest jedynym przełącznikiem obecności nagłówka.

**Umowa**: Przyjmuje te same propsy co `Layout.astro` (`title?: string`) i przekazuje je dalej;
opakowuje `Layout.astro`, renderuje `<AppHeader />` przed `<slot />`. **Nie** przyjmuje żadnego
innego propsa — ani włączającego nagłówek, ani szerokości, ani trybu układu.

**Powłoka nie wnosi kontenera treści.** Kształt to `bg-cosmic flex min-h-screen flex-col text-white`
na opakowaniu, w środku `<AppHeader />`, a pod nim `<slot />` w opakowaniu `flex-1` (żeby karty
wyśrodkowane w pionie miały czym się wyśrodkować). Każda strona **zachowuje swój dzisiejszy
kontener wewnętrzny** — `mx-auto w-full max-w-3xl`, `max-w-6xl` albo wyśrodkowaną kartę
`flex items-center justify-center` + `max-w-sm`.

Trzy powody, dla których kontener treści **nie** wchodzi do powłoki, mimo że jest powtórzony:

- Strony nie mają jednego układu, tylko dwa: górno-wyrównany (`index`, `teams/new`, `teams/[id]`)
  i wyśrodkowana karta (`TeamNotFound`, `embark`). Prop, który je rozróżnia, byłby dokładnie tym
  cichym przełącznikiem, przed którym ostrzega sekcja „Podejście do implementacji".
- `min-h-screen` w dwóch miejscach naraz (powłoka + strona) daje wysokość dokumentu
  `wysokość nagłówka + 100vh`, czyli stały martwy pasek przewijania na **każdym** ekranie powłoki.
  Dlatego `min-h-screen` żyje wyłącznie na opakowaniu powłoki, a strony przechodzą na `flex-1`
  tam, gdzie dziś mają `min-h-screen`.
- `bg-cosmic` (`src/styles/global.css:113-115`) ustawia **tylko** `background-image`. Nagłówek
  wyrenderowany nad kontenerem z tą klasą malowałby się na `bg-background` — widoczny szew poziomy.
  Nagłówek musi być **wewnątrz** pudełka niosącego `bg-cosmic`.

Deduplikacji kontenerów nie obiecuje ani „Pożądany stan końcowy", ani żadne Kryterium sukcesu —
jest poza zakresem tej zmiany.

#### 3. Ekran „Team not found" w powłoce

**Plik**: `src/components/team/TeamNotFound.astro`

**Cel**: Pierwszy konsument powłoki. Dziś to ślepa uliczka z dwoma linkami wyjścia celującymi
w `/teams` i `/dashboard` — obie trasy nie istnieją po wymaganiu wstępnym. Nagłówek daje wyjście,
a linki znikają.

**Umowa**: Zamiana importu `Layout` na `AppLayout` przy zachowaniu `title="Team not found"`;
usunięcie bloku dwóch linków (`src/components/team/TeamNotFound.astro:30-37`). Własny kontener
karty **zostaje**, z jedną korektą: `min-h-screen` na `src/components/team/TeamNotFound.astro:24`
zamienia się na `flex-1` (`min-h-screen` żyje teraz raz, na opakowaniu powłoki — patrz pkt 2),
reszta klas (`flex items-center justify-center p-4`, `max-w-sm`) bez zmian. `bg-cosmic` schodzi
z tego diva, bo niesie je powłoka. Komponent **nadal
nie przyjmuje żadnego propsa** — komentarz w pliku (linie 4-8) uzasadnia to izolacją z S-07 i ta
własność jest wiążąca: obie trasy dynamiczne muszą odpowiadać na cudze id identycznie. Zaktualizuj
ten komentarz tak, by opisywał stan po zmianie, zamiast zostawiać go opisującym usunięte linki —
i **nie używaj w nim literału `Astro.props`**: strażnik z Kryteriów sukcesu strzyże wprawdzie
linie komentarza, ale proza opisująca dokładnie to, czego grep ma nie znaleźć, jest tu klasą
błędu samą w sobie (`lessons.md`). Pisz „bez propsów", nie „nie czyta `Astro.props`".

#### 4. Usunięcie osieroconego paska

**Plik**: `src/components/Topbar.astro`

**Cel**: Plik nie ma konsumenta po usunięciu `Welcome.astro` w wymaganiu wstępnym, a jego rolę
przejął `AppHeader.astro`. Martwy komponent `.astro` nie jest łapany przez lint ani typy, więc
zostawiony myliłby następnego czytającego.

**Umowa**: Kasacja pliku. Przed nią potwierdź, że nie ma już importu — `Welcome.astro:2` był
jedynym.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Osierocony pasek nie istnieje: `! test -e src/components/Topbar.astro`
- Nikt go nie importuje: `! grep -rn 'components/Topbar' src/`
- Nagłówek **korzysta** z modułu nawigacji, a nie z własnej kopii reguły:
  `grep -nE '^import .* from "@/lib/nav"' src/components/AppHeader.astro`
- Adresy pozycji menu przychodzą z listy, nie z markupu (wzorzec strzyże komentarze — patrz
  strażnik propsów niżej): `! grep -vE '^\s*(//|\*|/\*)' src/components/AppHeader.astro | grep -q 'href="'`
  (`Sign out` jest `<form action="/api/auth/signout">`, nie `href`, więc nie wchodzi w kolizję.)
  Przesondowane 2026-09-06 na syntetycznym nagłówku poza repozytorium: oba kryteria zielone dla
  `<a href={item.href}>` nad `NAV_ITEMS` i czerwone po wpisaniu `href="/teams/new"` na sztywno.
- Ekran 404 jest w powłoce: `grep -n 'from "@/layouts/AppLayout.astro"' src/components/team/TeamNotFound.astro`
- Ekran 404 nie ma już linków wyjścia: `! grep -nE 'href="/(dashboard|teams)"' src/components/team/TeamNotFound.astro`
- Ekran 404 nadal nie przyjmuje propsów (niezmiennik S-07) — wzorzec strzyże komentarze, bo ten
  sam punkt każe przepisać prozę w liniach 4-8 (`lessons.md` → „Kryteria grepowe kotwicz na
  składni, nie na słowach"):
  `! grep -vE '^\s*(//|\*|/\*)' src/components/team/TeamNotFound.astro | grep -q 'Astro\.props'`
  Przesondowane 2026-09-06 na kopii pliku poza repozytorium: wariant literalny (`grep -n 'Astro.props'`)
  czerwieni się fałszywie, gdy komentarz wspomni `Astro.props`; wariant powyżej przechodzi wtedy
  zielono, a po dopisaniu realnego `const { reason } = Astro.props;` czerwieni się poprawnie.
- Testy przechodzą: `npm test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja:

- Wejście na `/teams/<losowy-uuid>` pokazuje ekran „Team not found" **z nagłówkiem**: e-mail
  zalogowanego po lewej, `Your teams` / `New team` / `Sign out` po prawej.
- Karta 404 jest widoczna w całości bez przewijania, nadal wyśrodkowana w pionie pod nagłówkiem,
  a strona **nie ma paska przewijania** (kontrola, że `min-h-screen` nie zdublowało się między
  powłoką a kartą). Nagłówek leży na gradiencie `bg-cosmic`, bez szwu na styku z treścią.
- Z ekranu 404 da się wyjść wyłącznie przez nagłówek — `Your teams` prowadzi na `/`,
  `New team` na `/teams/new`.
- `Sign out` w nagłówku wylogowuje i kończy przekierowaniem `/` → `/auth/signin`: trasa signout
  celuje w `/`, a `/` jest po wymaganiu wstępnym w `PROTECTED_ROUTES`, więc middleware odbija na
  logowanie. Ekran logowania **nie ma** nagłówka.
- Na ekranie 404 żadna pozycja menu nie jest wyróżniona (`/teams/<uuid>` nie pasuje do żadnej).
- Kod odpowiedzi dla nieistniejącego id to nadal 404 (zakładka narzędzi sieciowych) — powłoka nie
  zmieniła `Astro.response.status`.

**Uwaga implementacyjna**: Po zielonych kryteriach automatycznych zatrzymaj się i potwierdź
weryfikację ręczną, zanim przejdziesz do Fazy 3.

---

## Faza 3: Migracja stron domenowych

### Przegląd

Cztery pozostałe strony przechodzą na powłokę, a wraz z tym znikają wszystkie per-stronowe linki
nawigacyjne — także te w gałęziach awarii, pustej listy i na ekranie potwierdzenia zapisu.
Po tej fazie nawigacja ma w `src/` dokładnie jedno źródło.

### Wymagane zmiany:

#### 1. Lista drużyn na stronie głównej

**Plik**: `src/pages/index.astro`

**Cel**: Strona przejmuje powłokę; jej własny nagłówek redukuje się do samego tytułu. Znikają link
„← Back to dashboard" obok `<h1>` i przycisk „Back to dashboard" z gałęzi awarii odczytu.

**Umowa**: Import `AppLayout` zamiast `Layout` (`title="Your teams"`); zewnętrzny
`bg-cosmic min-h-screen p-4 text-white` redukuje się do `p-4` (tło i wysokość niesie powłoka),
wewnętrzny `mx-auto w-full max-w-3xl` **zostaje w pliku**; usunięcie obu odwołań do `/dashboard`. Trzy gałęzie stanu — awaria odczytu (`teams === null`),
pusta lista, lista z wierszami — oraz baner `?deleted=1` zostają bez zmian co do treści i warunków.
Przycisk „Assemble your first team" / „Assemble a new team" **zostaje**: to wezwanie do działania
w kontekście listy, nie nawigacja powłoki.

**Uwaga o stanie pliku**: w chwili pisania tego planu `src/pages/index.astro` renderuje jeszcze
`<Welcome />`; treść listy trafia tu z `src/pages/teams/index.astro` w wymaganiu wstępnym.
Numery linii w tym punkcie odnoszą się do `src/pages/teams/index.astro:52-74` sprzed przenosin.

#### 2. Kompletowanie nowej drużyny

**Plik**: `src/pages/teams/new.astro`

**Cel**: To samo co wyżej: powłoka zamiast własnego układu, tytuł bez linku powrotnego, gałąź awarii
puli bez przycisku „Back to dashboard".

**Umowa**: Import `AppLayout` (`title="New team"`); zewnętrzny `bg-cosmic min-h-screen p-4 text-white`
redukuje się do `p-4`, wewnętrzny `mx-auto w-full max-w-6xl` zostaje w pliku; usunięcie
odwołań do `/dashboard` z `src/pages/teams/new.astro:40` i `:57`. Wyspa `<TeamComposer … client:load />`
i `<ServerError />` bez zmian.

#### 3. Szczegóły i edycja zapisanej drużyny

**Plik**: `src/pages/teams/[id].astro`

**Cel**: Powłoka zamiast własnego układu; znika link „← Your teams" obok `<h1>` oraz przycisk
„Back to your teams" z gałęzi awarii/niespójności.

**Umowa**: Import `AppLayout` **wyłącznie w gałęzi `else`** warunku `notFound` (zewnętrzny
`bg-cosmic min-h-screen p-4 text-white` → `p-4`, wewnętrzny `mx-auto w-full max-w-6xl` zostaje) —
gałąź `notFound` renderuje `<TeamNotFound />`, który po Fazie 2 nosi powłokę sam. Usunięcie odwołań
do `/teams` z `src/pages/teams/[id].astro:115` i `:146`. Bez zmian zostają: `Astro.response.status = 404`
we frontmatterze (nigdy top-level `return` — `context/foundation/lessons.md`), warunki gałęzi,
paski `?saved=1` / `?error=`, wyspa `<TeamComposer … client:load />` z `teamId` i `<DeleteTeamDialog … client:load />`.

#### 4. Potwierdzenie zapisu

**Plik**: `src/pages/teams/[id]/embark.astro`

**Cel**: Powłoka zamiast własnego układu; z listy czterech linków na dole karty zostaje wyłącznie
„View this team", bo tylko on jest kontekstowy — celuje w konkretną, właśnie zapisaną drużynę
i nie ma odpowiednika w menu. „Your teams", „Assemble another team" i „Back to dashboard"
duplikują nagłówek albo celują w usuniętą trasę.

**Umowa**: Import `AppLayout` w gałęzi `else` warunku `notFound` (gałąź `notFound` to
`<TeamNotFound />` z własną powłoką); usunięcie odwołań z `src/pages/teams/[id]/embark.astro:77`,
`:83` i `:93`. Karta jest wyśrodkowana i **zostaje wyśrodkowana**: `bg-cosmic flex min-h-screen
items-center justify-center p-4` (`:57`) → `flex flex-1 items-center justify-center p-4`, `max-w-sm`
bez zmian. Ten sam ruch co w `TeamNotFound` (Faza 2 pkt 3) — `min-h-screen` i `bg-cosmic` należą
teraz do powłoki.
Treść potwierdzenia zapisu i blok „Work in Progress" zostają nietknięte: FR-019 wymaga, by komunikat
wprost potwierdzał zapis.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- Żadne odwołanie do usuniętych tras nie zostało w `src/`: `! grep -rnE 'href="/(dashboard|teams)"' src/`
- Żadna strona domenowa nie importuje już `Layout` bezpośrednio:
  `! grep -nE '^import .* from "@/layouts/Layout.astro"' src/pages/index.astro src/pages/teams/new.astro 'src/pages/teams/[id].astro' 'src/pages/teams/[id]/embark.astro' src/components/team/TeamNotFound.astro`
- Wszystkie pięć plików jest w powłoce:
  `test "$(grep -lE '^import .* from "@/layouts/AppLayout.astro"' src/pages/index.astro src/pages/teams/new.astro 'src/pages/teams/[id].astro' 'src/pages/teams/[id]/embark.astro' src/components/team/TeamNotFound.astro | wc -l | tr -d ' ')" = 5`
- `/auth/*` **nie** weszło do powłoki: `! grep -rn 'AppLayout' src/pages/auth/`
- 404 nadal idzie przez `Astro.response.status`, nie przez top-level `return`:
  `! grep -nE '^return ' 'src/pages/teams/[id].astro' 'src/pages/teams/[id]/embark.astro'`
  (kotwica na kolumnie 0 — celem jest **top-level** `return`, nie `return` wewnątrz funkcji pomocniczej)
- Testy przechodzą: `npm test`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npm run build`

#### Ręczna weryfikacja:

- Nagłówek jest identyczny na `/`, `/teams/new`, `/teams/<własne-id>`, `/teams/<własne-id>/embark`
  i na ekranie 404 — ta sama pozycja, te same trzy elementy, ten sam e-mail.
- `Your teams` jest wyróżnione **wyłącznie** na `/`; `New team` **wyłącznie** na `/teams/new`;
  na `/teams/<id>` i `/teams/<id>/embark` żadna pozycja nie jest wyróżniona.
- Na żadnym z pięciu ekranów nie ma już linku „← Back to dashboard", „← Your teams",
  „Back to dashboard" ani „Back to your teams".
- Ekran potwierdzenia zapisu ma dokładnie jeden link kontekstowy — „View this team" — i prowadzi
  do właśnie zapisanej drużyny.
- Gałęzie awarii nadal dają się zobaczyć i mają wyjście przez nagłówek: wyłącz Supabase
  (`SUPABASE_URL`/`SUPABASE_KEY`) i sprawdź, że karta błędu renderuje się w powłoce.
- Pełna pętla CRUD przechodzi bez regresji: zapis nowej drużyny → `embark` → edycja → usunięcie
  (baner „Team deleted." na `/`).
- Wylogowanie z nagłówka na każdym z pięciu ekranów kończy się tak samo: `/` → `/auth/signin`,
  bez nagłówka i bez sesji.

**Uwaga implementacyjna**: To ostatnia faza; po jej ręcznym potwierdzeniu zmiana jest gotowa do
`/10x-impl-review`.

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/nav.test.ts` — reguła aktywnej pozycji. Przypadki brzegowe wprost: dopasowanie `/` jako
  `exact` (pułapka `startsWith("/")` łapiąca każdą trasę), granica segmentu w trybie `prefix`
  (`/teams/newton` nie podświetla „New team"), normalizacja końcowego ukośnika.
- Kształt listy pozycji: dwa wpisy, `href` równe `/` i `/teams/new`, żaden nie celuje w `/dashboard`
  ani `/teams`. To jedyny automatyczny strażnik treści menu wobec punktu 2 zgłoszenia.

### Testy integracyjne:

Brak. Repo nie ma warstwy integracyjnej, a `AGENTS.md` zabrania testom bootstrapować Astro
i Supabase — zachowanie powłoki weryfikuje `npm run build` (kompilacja wszystkich `.astro`)
plus kroki ręczne poniżej.

### Kroki testowania ręcznego:

1. Zaloguj się i przejdź kolejno przez `/`, `/teams/new`, `/teams/<własne-id>`,
   `/teams/<własne-id>/embark`, `/teams/<losowy-uuid>` (404) — potwierdź identyczny nagłówek
   z własnym e-mailem na każdym.
2. Na każdym z tych ekranów sprawdź wyróżnienie: `Your teams` tylko na `/`, `New team` tylko
   na `/teams/new`, nigdzie indziej nic.
3. Potwierdź, że nie został żaden link powrotny poza nagłówkiem, także w gałęziach awarii.
4. Wyłącz zmienne Supabase i odwiedź `/` oraz `/teams/new` — karty awarii renderują się w powłoce
   i da się z nich wyjść nagłówkiem.
5. Przejdź pełną pętlę CRUD (zapis → embark → edycja → usunięcie) i potwierdź brak regresji.
6. Wyloguj się z nagłówka i potwierdź, że wejście na `/` przekierowuje na `/auth/signin`,
   a ekran logowania **nie** ma nagłówka.

## Uwagi dotyczące wydajności

Brak implikacji. Powłoka jest czystym SSR — zero `client:*`, zero dodatkowego JS w bundlu.
Nagłówek nie wykonuje żadnego zapytania: `Astro.locals.user` jest już wypełnione przez middleware,
które i tak biegnie dla każdego żądania. Wymaganie pozafunkcjonalne „poniżej 200 ms" z PRD dotyczy
reakcji wykresu na zmianę składu i nie jest tą zmianą dotykane.

## Uwagi dotyczące migracji

Brak migracji danych — zmiana jest wyłącznie w warstwie prezentacji. Brak zmian w `supabase/`,
w `src/lib/team-repo.ts` i w trasach API.

Ryzyko wycofania jest niskie i lokalne: każda faza jest osobnym commitem, a Faza 3 dotyka pięciu
plików, z których każdy da się cofnąć niezależnie.

Zakładki zapisane pod `/dashboard` i `/teams` przestają działać — to skutek wymagania wstępnego
`2026-09-06-teams-list-as-home`, nie tej zmiany, i PRD nie stawia wymagania o trwałości adresów.

## Referencje

- Tożsamość zmiany: `context/changes/2026-09-06-app-shell-header-nav/change.md`
- Wymaganie wstępne: `context/changes/2026-09-06-teams-list-as-home/change.md`
- Zmiana siostrzana: `context/changes/2026-09-06-team-action-buttons/change.md`
- Powtarzające się reguły: `context/foundation/lessons.md`
- Nagłówek do zastąpienia: `src/components/Topbar.astro:1-40`
- Jedyny konsument tego nagłówka dziś: `src/components/Welcome.astro:28`
- Powłoka HTML, która zostaje bez zmian: `src/layouts/Layout.astro:1-49`
- Źródło `Astro.locals.user`: `src/middleware.ts:6-16`
- Niezmiennik „bez propsów" ekranu 404: `src/components/team/TeamNotFound.astro:4-8`
- Wzorzec stylu testu: `src/lib/missing-competencies.test.ts:1-22`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Czysty moduł nawigacji

#### Automatyczne

- [x] 1.1 Wymaganie wstępne `2026-09-06-teams-list-as-home` wdrożone (bramka) — b5c64fa
- [x] 1.2 Testy przechodzą: `npm test` — b5c64fa
- [x] 1.3 Moduł jest czysty (brak importów `astro:*` i `@/lib/supabase`) — b5c64fa
- [x] 1.4 Moduł nie zna usuwanych tras `/dashboard` i `/teams` — b5c64fa
- [x] 1.5 Linting przechodzi: `npm run lint` — b5c64fa
- [x] 1.6 Build przechodzi: `npm run build` — b5c64fa

### Faza 2: Powłoka i pierwszy konsument

#### Automatyczne

- [x] 2.1 `src/components/Topbar.astro` nie istnieje — f6f5266
- [x] 2.2 Nikt nie importuje `components/Topbar` — f6f5266
- [x] 2.3 `AppHeader.astro` importuje moduł `@/lib/nav` — f6f5266
- [x] 2.4 `AppHeader.astro` nie ma literalnych `href` pozycji menu — f6f5266
- [x] 2.5 `TeamNotFound.astro` importuje `AppLayout` — f6f5266
- [x] 2.6 `TeamNotFound.astro` nie ma już linków do `/dashboard` ani `/teams` — f6f5266
- [x] 2.7 `TeamNotFound.astro` nadal nie przyjmuje propsów (niezmiennik S-07) — f6f5266
- [x] 2.8 Testy przechodzą: `npm test` — f6f5266
- [x] 2.9 Linting przechodzi: `npm run lint` — f6f5266
- [x] 2.10 Build przechodzi: `npm run build` — f6f5266

#### Ręczne

- [x] 2.11 Ekran 404 pokazuje nagłówek z e-mailem i trzema elementami menu — f6f5266
- [x] 2.12 Karta 404 wyśrodkowana i widoczna bez przewijania; brak paska przewijania; brak szwu tła — f6f5266
- [x] 2.13 Wyjście z ekranu 404 działa wyłącznie przez nagłówek (`Your teams` → `/`, `New team` → `/teams/new`) — f6f5266
- [x] 2.14 `Sign out` z nagłówka wylogowuje i kończy przekierowaniem `/` → `/auth/signin` — f6f5266
- [x] 2.15 Na ekranie 404 żadna pozycja menu nie jest wyróżniona — f6f5266
- [x] 2.16 Odpowiedź dla nieistniejącego id to nadal 404 — f6f5266

### Faza 3: Migracja stron domenowych

#### Automatyczne

- [x] 3.1 Brak `href="/dashboard"` i `href="/teams"` w całym `src/`
- [x] 3.2 Żadna strona domenowa nie importuje `Layout.astro` bezpośrednio
- [x] 3.3 Wszystkie pięć plików importuje `AppLayout.astro`
- [x] 3.4 `/auth/*` nie weszło do powłoki
- [x] 3.5 404 nadal idzie przez `Astro.response.status`, nie przez top-level `return`
- [x] 3.6 Testy przechodzą: `npm test`
- [x] 3.7 Linting przechodzi: `npm run lint`
- [x] 3.8 Build przechodzi: `npm run build`

#### Ręczne

- [x] 3.9 Nagłówek identyczny na wszystkich pięciu ekranach
- [x] 3.10 Wyróżnienie aktywnej pozycji zgodne: `/` → `Your teams`, `/teams/new` → `New team`, reszta bez wyróżnienia
- [x] 3.11 Żaden link powrotny nie został na żadnym z pięciu ekranów
- [x] 3.12 Ekran potwierdzenia zapisu ma dokładnie jeden link kontekstowy „View this team"
- [x] 3.13 Gałęzie awarii (Supabase wyłączony) renderują się w powłoce i mają wyjście
- [x] 3.14 Pełna pętla CRUD bez regresji (zapis → embark → edycja → usunięcie)
- [x] 3.15 Wylogowanie z nagłówka z każdego z pięciu ekranów kończy się na `/auth/signin`
