# Wyciągnięte wnioski

> Rejestr powtarzających się reguł i wzorców, tylko do dodawania. Ponownie odczytywany na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Po `npx shadcn add` popraw importy na pakiety per-prymityw

- **Context**: `src/components/ui/dialog.tsx:2,6` (S-01, commit fafdd83); dotyczy każdego
  kolejnego `npx shadcn@latest add <name>` (np. `alert-dialog` w S-06).
- **Problem**: shadcn CLI 4.x generuje `import { X as XPrimitive } from "radix-ui"` (pakiet
  parasolowy) oraz `import { cn } from "cn"` (obcy pakiet), podczas gdy repo trzyma zależności
  per-prymityw (`@radix-ui/react-slot`, `@radix-ui/react-dialog`) i `cn` w `@/lib/utils`.
  Plan S-01 wymagał jednocześnie „nie edytować wygenerowanego pliku" i „`@radix-ui/react-<x>`
  w `dependencies`" — sprzeczność, którą trzeba było rozstrzygnąć ręcznie w trakcie implementacji.
- **Rule**: Po wygenerowaniu prymitywu zamień `from "radix-ui"` na
  `import * as XPrimitive from "@radix-ui/react-<x>"` (i dodaj ten pakiet do `dependencies`),
  a `from "cn"` na `from "@/lib/utils"`. Nie edytuj nic poza tymi importami i tym, co wymusi
  prettier. Sprawdź `git diff`, że CLI nie ruszyło `components.json` ani `global.css`, i że
  `package-lock.json` nie zawiera `radix-ui` ani `cn`. Plan takiej fazy ma nazywać tę korektę
  wprost zamiast pisać „nie edytować".
- **Applies to**: `/10x-plan` i `/10x-implement` dla każdej fazy dodającej prymityw shadcn;
  `/10x-impl-review` przy sprawdzaniu `src/components/ui/*`.

## W `.astro` nie planuj top-level `return` — 404 przez `Astro.response.status`, redirect przez middleware

- **Context**: `src/pages/teams/[id]/embark.astro:9-12, 32-40` (S-03, commit 7df2b32); plan
  `context/changes/first-saved-team/plan.md` §Faza 3 pkt 4 zapisał umowę jako
  `return new Response(null, { status: 404 })`.
- **Problem**: Top-level `return` we frontmatterze `.astro` jest legalny dla Astro, ale typowana reguła
  `@typescript-eslint/no-misused-promises` (`strictTypeChecked` + `astro-eslint-parser`) crashuje na nim
  („Non-null Assertion Failed: Expected node to have a parent" — w zwykłym TS `return` poza funkcją
  to błąd składni, więc reguła zakłada funkcję-przodka) i wywraca `npm run lint`, czyli CI. Dotyczy tak
  samo `return new Response(...)` jak `return Astro.redirect(...)` (zweryfikowane sondą 2026-09-05).
  Plan był niewykonalny w literze; implementacja musiała rozstrzygnąć to sama.
- **Rule**: Wczesne wyjście ze strony `.astro` (404, 403, pusta odpowiedź) zapisuj jako
  `Astro.response.status = <kod>` plus gałąź szablonu renderująca `null`. Redirect ze strony `.astro`
  rób w `src/middleware.ts` (`PROTECTED_ROUTES`) albo w trasie API pod `src/pages/api/` — nigdy jako
  top-level `return Astro.redirect(...)`. Plan fazy ma nazywać ten mechanizm wprost, nie „zwróć 404".
- **Applies to**: `/10x-plan` przy każdej stronie `.astro` z gałęzią 404/403 lub redirectem (S-04 lista
  i szczegóły, S-07 izolacja); `/10x-implement` i `/10x-impl-review` przy `src/pages/**/*.astro`.

## Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana, nie dwie

- **Context**: `src/pages/teams/[id].astro:96-104` (S-04, commit 94fee01) —
  `<TeamComposer pool={pool} initialComposition={composition} readOnly />` renderowany serwerowo,
  bez dyrektywy `client:*`, z notą „S-05: dopisać `client:load` z powrotem".
- **Problem**: „Tryb odczytu" jest wyrażony dwoma niezależnymi przełącznikami w dwóch różnych
  warstwach: propem `readOnly` w wyspie i **brakiem** `client:*` w `.astro`. Muszą się zgadzać, ale
  nic ich nie wiąże. Rozjechanie ich daje awarię cichą w obie strony: `client:load` bez zdjęcia
  `readOnly` to ekran hydratowany i martwy (JS ładowany bez powodu), a zdjęcie `readOnly` bez
  `client:load` to ekran z przyciskami, które nic nie robią. Ani lint, ani testy, ani typy tego nie
  łapią — `readOnly` jest poprawnym propem, a brak `client:*` poprawnym Astro.
- **Rule**: Gdy strona `.astro` renderuje wyspę bez `client:*`, bo jej tryb czyni ją
  nieinteraktywną, traktuj parę (dyrektywa hydratacji, flaga trybu) jako **jeden przełącznik**:
  plan fazy zmieniającej którykolwiek z nich ma wymieniać oba w tym samym punkcie „Wymagane zmiany",
  a implementacja zmieniać je w tym samym commicie. Nigdy nie zostawiaj `readOnly` przy dopisanym
  `client:*` ani odwrotnie.
- **Applies to**: `/10x-plan` przy każdej fazie dokładającej lub zdejmującej interaktywność
  istniejącej wyspy (S-05 `edit-saved-team` w pierwszej kolejności); `/10x-implement`
  i `/10x-impl-review` przy `src/pages/**/*.astro` renderujących `src/components/**` bez `client:*`.

## Kryteria grepowe kotwicz na składni, nie na słowach — komentarze też są w pliku

- **Context**: `context/changes/delete-team-confirmed/plan.md` §Progress 1.7, 1.9, 3.11 (S-06,
  commity 97f14d3 i 335a80a); wcześniej ta sama klasa w `src/lib/teams-policy-sql.test.ts`
  (S-05), gdzie test musiał dostać helper `allMigrationsWithoutComments()`.
- **Problem**: Trzy kryteria automatyczne planu — `! grep -nE 'from "astro|@/lib/supabase'
  src/lib/team-repo.ts`, `! grep -rn "grant all\|grant.*truncate" supabase/migrations/`,
  `! grep -n "client:" src/pages/teams/index.astro` — uruchomione dosłownie **nie przechodzą**:
  trafiają w docstring `team-repo.ts:8` („bez importu `@/lib/supabase`"), w komentarz
  `20260905090700_character_pool_revoke_writes.sql:4` („grant all on tables") i w komentarz
  `index.astro:29` („zero `client:*`"). Wszystkie trzy linie istniały przed zmianą, więc intencja
  była spełniona, a mimo to Progress podpisał je `[x]` z hashem commitu. Plan sam ostrzegał przy
  1.9, że „grep biegnie po surowych plikach" — i wybrał wzorzec trafiający w cudzy komentarz.
  Im lepiej udokumentowany kod, tym częściej proza opisuje dokładnie to, czego grep ma nie znaleźć.
- **Rule**: Kryterium grepowe w planie ma być zakotwiczone na składni, nie na słowie:
  `^import .* from "@/lib/supabase"` zamiast `@/lib/supabase`, `^\s*grant\s` zamiast `grant`,
  `client:load` / `client:[a-z]+=` zamiast `client:`. Gdy kotwica nie istnieje, kryterium ma
  strzyc komentarze przed dopasowaniem (`grep -v '^\s*\(//\|--\|\*\)'` lub helper w teście).
  Przed odhaczeniem `[x]` komenda musi zostać **uruchomiona i przejść dosłownie** — `[x]` nie znaczy
  „intencja spełniona", tylko „komenda zielona"; jeśli komenda jest wadliwa, poprawia się komendę
  w planie, nie odhacza na ślepo.
- **Applies to**: `/10x-plan` i `/10x-plan-review` przy każdym kryterium „Automatyczna weryfikacja"
  opartym na `grep`; `/10x-implement` przy odhaczaniu Progress; `/10x-impl-review` — uruchamiaj
  komendy dosłownie i zgłaszaj rozjazd litery z intencją.

## Strażnik grepowy nad SQL-em ma pokrywać legalne warianty zapisu, nie jeden zapis

- **Context**: `src/lib/teams-policy-sql.test.ts` (S-07, triaż przeglądu implementacji 2026-09-06,
  ustalenia F1 i F2). Rozwinięcie §„Kryteria grepowe kotwicz na składni, nie na słowach" o kierunek,
  którego tamta lekcja nie obejmowała.
- **Problem**: Sześć strażników negatywnych pilnujących RLS na `teams` kotwiczyło się na literalnym
  `public.teams`, a strażnik tabelowego update — na `grant\s+update\s+on`. Sonda na kopii
  repozytorium (dopisana migracja, `npm test`) pokazała, że **przechodzą na zielono**:
  `alter table teams disable row level security;`, `drop policy … on teams;`, `grant all on teams …`,
  `alter table "public"."teams" …`, `grant update, delete on public.teams` oraz
  `grant all on all tables in schema public`. Każda z nich jest dokładnie tak samo skuteczna jak
  wariant, którego strażnik pilnował — `search_path` migracji Supabase obejmuje `public`, a Postgres
  sumuje przywileje. Strażnik pilnował **jednego zapisu**, nie **operacji**, i milczałby przy
  rozbrojeniu bariery. Osobno ta sama klasa od strony furtki: `alter policy`, świadomie wyłączone
  z zasięgu strażnika `drop policy`, przepuszczało `alter policy "owner can read teams" on
  public.teams using (true);` — czyli rozbrojenie jedynej bariery odczytu, i to dokładnie tę mutację,
  którą komentarz obok sam nazywał najgroźniejszą.
- **Rule**: Zanim napiszesz strażnika negatywnego nad SQL-em, wypisz **legalne warianty zapisu tej
  samej operacji**: nazwa bez schematu, nazwa w cudzysłowach (`public."teams"`, `"public"."teams"`),
  `alter table only`, lista przywilejów zamiast jednego (`grant update, delete on …`), forma
  schematowa (`grant all on all tables in schema public`), rola nadrzędna (`public` obejmuje `anon`).
  Pokryj je **jednym wspólnym fragmentem wzorca** (stała w rodzaju `TEAMS_TABLE`), zamiast powtarzać
  literał w każdym regexie — inaczej wzorce rozjadą się przy pierwszej korekcie. Każdą furtkę
  zostawioną świadomie domknij warunkiem **pozytywnym** („wolno, o ile polecenie dalej zawiera
  `auth.uid()`"), nigdy nie zostawiaj jej otwartej. I przesonduj strażnika, zanim go odhaczysz:
  kopia migracji poza repozytorium, dopisana migracja z każdym wariantem, potwierdzenie, że każdy
  wariant rozbrajający czerwieni, a każdy legalny przechodzi. Strażnik nieprzesondowany jest
  dekoracją — tak samo jak asercja pozytywna bez kontroli mutacyjnej.
- **Applies to**: `/10x-plan` i `/10x-plan-review` przy każdej umowie strażnika nad
  `supabase/migrations/` (umowa ma wymieniać warianty, nie jeden wzorzec); `/10x-implement` przy
  pisaniu asercji negatywnych; `/10x-impl-review` — sonduj wzorce wariantami, nie czytaj samego
  regexu.

## Strażnik, który jest zielony na commicie bazowym, nie wiąże niczego

- **Context**: `context/changes/2026-09-06-app-shell-header-nav/plan.md:316,425` — kryteria 2.6
  i 3.1 (`! grep -rnE 'href="/(dashboard|teams)"' src/`), odhaczone `[x]` w Progress z hashami
  commitów f6f5266 i dbcc40e. Trzecie z rzędu wystąpienie klasy „strażnik grepowy nie wiąże",
  po §„Kryteria grepowe kotwicz na składni, nie na słowach" (S-06) i §„Strażnik grepowy nad SQL-em
  ma pokrywać legalne warianty zapisu" (S-07).
- **Problem**: Oba strażniki miały potwierdzić wycięcie linków powrotnych w fazach 2 i 3.
  `git grep -nE 'href="/(dashboard|teams)"' b5c64fa^ -- src/` nie zwraca **nic**: wymaganie
  wstępne `2026-09-06-teams-list-as-home` przepisało już te linki na `href="/"`. Oba strażniki
  były więc zielone **przed** pierwszym commitem zmiany i pozostałyby zielone, gdyby faza 3 nie
  zrobiła nic. Praca, której naprawdę bronią — wycięcie siedmiu linków `href="/"`
  i `href="/teams/new"` z `TeamNotFound.astro`, `new.astro`, `[id].astro`, `embark.astro` — nie
  ma żadnego pokrycia automatycznego; pilnuje jej wyłącznie ręczne 3.11. Sonda: ponowne wklejenie
  karty z linkiem „← Your teams" przechodzi wszystkie 12 strażników na zielono. Obie wcześniejsze
  lekcje zostały tu spełnione co do litery (kotwica na składni, strzyżenie komentarzy) — bo żadna
  nie mówi nic o **linii bazowej**. Plan opisywał pliki w stanie po wymaganiu wstępnym, ale
  kryteria napisał w słownictwie stanu sprzed niego.
- **Rule**: Strażnik negatywny jest wart tyle, ile jego czerwień **przed** zmianą. Zanim odhaczysz
  `[x]`, uruchom go na commicie bazowym (`git stash` albo `git grep <wzorzec> <base> -- <ścieżki>`)
  i potwierdź, że **czerwieni się tam**. Zielony na bazie znaczy, że pilnuje czegoś, czego już nie
  ma — wtedy przepisz go na to, co ta faza faktycznie usuwa, zamiast go odhaczać. Szczególnie gdy
  plan opisuje pliki w stanie po wymaganiu wstępnym: słownictwo kryteriów musi pochodzić z tego
  samego stanu co opis, inaczej strażnik celuje w nieistniejący już zapis. Ta sama próba należy się
  strażnikom pozytywnym w drugą stronę — `grep -n '<AppHeader' src/layouts/AppLayout.astro` ma
  czerwienić się na bazie, bo pliku tam jeszcze nie ma.
- **Applies to**: `/10x-plan` i `/10x-plan-review` przy każdym kryterium „Automatyczna weryfikacja"
  w planie, który ma wymaganie wstępne albo opisuje pliki w stanie po innej zmianie;
  `/10x-implement` przed każdym `[x]` w Progress; `/10x-impl-review` — uruchamiaj strażniki także
  na commicie bazowym zakresu, nie tylko na HEAD.

## Strażnik grepowy nad JSX/TS — wariantów cytowania jest cztery, a `return` bywa wcięty

- **Context**: `context/changes/2026-09-06-app-shell-header-nav/plan.md:178,179,311,320,432`
  (triaż przeglądu implementacji 2026-09-07, ustalenie F3). Rozwinięcie §„Strażnik grepowy nad
  SQL-em ma pokrywać legalne warianty zapisu, nie jeden zapis" na drugi język repozytorium:
  tamta lekcja wypisuje warianty nazw tabel i przywilejów, ta — warianty zapisu ścieżki,
  wyjścia i importu w `.astro`/TS.
- **Problem**: Pięć strażników planu przeszło dosłownie, a każdy przepuszcza legalny wariant tej
  samej operacji (sondy na kopiach poza repozytorium):
  `href="` łapie `href="/teams/new"`, przepuszcza `href={"/teams/new"}`, `href='/teams/new'`
  i `` href={`/teams/new`} ``; `^return ` przepuszcza `  return Astro.redirect("/")` oraz
  `if (notFound) { return new Response(...) }` — czyli **najczęstszy** kształt wczesnego wyjścia,
  ten, przed którym ostrzega lekcja S-03; `"/(dashboard|teams)"` przepuszcza `'/teams'`,
  `` `/teams` `` i `"/teams/"`, a `normalize()` sprowadza `"/teams/"` z powrotem do martwej trasy;
  strażnik importów (`^import .* from "(astro:|@/lib/supabase)`) przepuszcza `import "astro:env/server"`,
  `export * from "@/lib/supabase"`, `await import("@/lib/supabase")` i import względny;
  `Astro\.props` przepuszcza `Astro["props"]` i `const { props } = Astro` — a ten pilnuje
  niezmiennika izolacji S-07. Plan deklarował sondę przy dwóch z nich, ale przesondował wyłącznie
  wariant, który strażnik łapie — sonda potwierdzająca własne założenie nie jest sondą.
- **Rule**: Zanim napiszesz strażnika nad `.astro`/`.ts`/`.tsx`, wypisz warianty zapisu tej samej
  operacji, tak jak przy SQL-u. Ścieżka w atrybucie ma cztery formy: `href="…"`, `href='…'`,
  `href={"…"}`, `` href={`…`} `` — pokryj je jednym fragmentem, nie czterema regexami. `return`
  we frontmatterze bywa wcięty i bywa w `if`, więc kotwica to `^\s*return\s`, nigdy `^return `.
  Import ma formy bez `from` (`import "x"`), dynamiczną (`import("x")`), re-eksport
  (`export * from "x"`) i względną — jeśli strażnik pilnuje czystości modułu, musi objąć wszystkie.
  Literał ścieżki dopuszcza końcowy ukośnik, więc wzorzec i asercja testowa mają go tolerować
  (`/teams/?` zamiast `/teams`). I sonduj **wariantem rozbrajającym**, nie tym, który łapiesz:
  strażnik uznany za przesondowany na podstawie wariantu pozytywnego jest nieprzesondowany.
- **Applies to**: `/10x-plan` i `/10x-plan-review` przy każdym kryterium „Automatyczna weryfikacja"
  grepującym po `src/**/*.{astro,ts,tsx}`; `/10x-implement` przy pisaniu asercji negatywnych
  w testach (`not.toBe("/teams")` ma tę samą dziurę co grep); `/10x-impl-review` — sonduj wariantem,
  który ma przejść, a nie tym, który ma paść.
