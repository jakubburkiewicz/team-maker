---
change_id: cross-account-team-isolation
title: Cudza drużyna jest niedostępna każdą ścieżką
status: planned
created: 2026-09-06
updated: 2026-09-06
---

## Notes

- Element mapy drogowej: **S-07** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień B —
  pętla CRUD nad zapisaną drużyną). Ostatni fragment domykający Guardrail „izolacja danych między
  kontami” oraz wymaganie pozafunkcjonalne „liczba drużyn cudzego konta widocznych lub
  modyfikowalnych wynosi zero”.
- Wymagania wstępne: S-05 (`edit-saved-team`) i S-06 (`delete-team-confirmed`), oba zarchiwizowane
  2026-09-06. Dopiero po nich istnieją wszystkie cztery operacje CRUD, na których da się wykazać zero.
- Odnośniki PRD: US-04, FR-004, Guardrail „izolacja danych między kontami”, wymaganie
  pozafunkcjonalne o własności binarnej.
- **Punkt wyjścia jest nietypowy: mechanizm izolacji już stoi kompletny.** RLS pokrywa wszystkie
  cztery operacje (`owner can insert/read/update/delete teams`), repo zwraca `null`
  nierozróżnialnie dla nieznanego id, cudzego wiersza i nie-UUID, a trasy API nie różnicują
  komunikatu. Ten fragment nie buduje izolacji — rozstrzyga, dowodzi i zakotwicza.
- Domyka zobowiązania zapisane imiennie do S-07 w trzech miejscach:
  - `context/archive/2026-09-05-first-saved-team/plan-brief.md:38` i
    `src/pages/teams/[id]/embark.astro:23` — „gołe 404 prowizorycznie; S-07 rozstrzyga docelowo
    (404 vs redirect) i dokłada nawigację”.
  - `context/archive/2026-09-06-delete-team-confirmed/follow-ups/review-fixes.md` (F2) —
    `encodeURIComponent` w `src/pages/api/teams/[id].ts`.
  - `context/archive/2026-09-06-own-teams-list-and-detail/follow-ups/review-fixes.md` (F8) —
    potwierdzenie, że produkcyjny `SUPABASE_KEY` nie omija RLS.
- Wiążące lekcje z `context/foundation/lessons.md`:
  - §„W `.astro` nie planuj top-level `return`” — wymienia S-07 wprost.
  - §„Kryteria grepowe kotwicz na składni, nie na słowach”.
- Decyzje projektowe z sesji planowania 2026-09-06:
  - **404 z pełną stroną**, nie redirect na listę. `Astro.response.status = 404` zostaje;
    zmienia się wyłącznie ciało odpowiedzi z pustego na ekran z nawigacją.
  - **Wspólny komponent `src/components/team/TeamNotFound.astro`** renderujący własny `Layout`,
    żeby obie trasy dawały odpowiedź identyczną co do tytułu, treści i nawigacji.
  - **Komunikat wprost i łącznie**: „This team does not exist, or it is not yours.” — nazywa
    regułę izolacji dla persony recenzenta, nie ujawniając, który z przypadków zaszedł.
  - **RLS zostaje jedyną barierą.** Żadnego `.eq("user_id", …)` w repo: filtr w kodzie maskowałby
    awarię polityki i uczyniłby dowód dwukontowy nierozstrzygającym.
  - **Dowód biegnie na produkcji**, nie lokalnie — zielony przebieg empirycznie wyklucza klucz
    `sb_secret_` i tym samym pochłania F8.
  - **Testy SQL domykają macierz czterech operacji** plus strażnicy negatywni na
    `disable row level security` i `drop policy`.
- Nie wymaga migracji bazy: polityki są komplet od S-06, a zmiana asercji w teście nie dotyka
  `supabase/`.
