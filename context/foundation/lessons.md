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
