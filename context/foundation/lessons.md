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
