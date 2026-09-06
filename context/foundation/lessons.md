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
