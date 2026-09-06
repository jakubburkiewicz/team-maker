---
change_id: own-teams-list-and-detail
title: Lista własnych drużyn i widok zapisanej drużyny
status: planned
created: 2026-09-06
updated: 2026-09-06
---

## Notes

- Element mapy drogowej: **S-04** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień B —
  pętla CRUD nad zapisaną drużyną). Domyka **R** z CRUD.
- Wymaganie wstępne: S-03 (`first-saved-team`, zarchiwizowane 2026-09-05) — tabela `public.teams`
  z RLS na własność, `POST /api/teams` jako jedyny pisarz, strona potwierdzenia `/teams/[id]/embark`.
- Odblokowuje: S-05 (`edit-saved-team`) i S-06 (`delete-team-confirmed`), a przez nie S-07.
- Rozstrzyga niewiadomą zapisaną przy S-04 („czy widok szczegółów startuje w trybie tylko do odczytu,
  czy od razu w trybie kompletowania"): **tryb tylko do odczytu na tej samej wyspie `TeamComposer`**
  — decyzja użytkownika z sesji planowania 2026-09-06.
- Rozstrzyga punkt kontrolny z przeglądu S-01 („co robić z `characterId` spoza puli"): skład, którego
  nie da się złożyć z aktualną pulą, jest **odmawiany w całości** — strona pokazuje stan awarii
  zamiast częściowego składu, żeby S-05 nie zapisał po cichu okrojonej drużyny.
- Decyzje projektowe z sesji planowania 2026-09-06: lista pod nową trasą `/teams` (mieści się
  w istniejącym prefiksie `PROTECTED_ROUTES`); wiersz listy to nazwa-hash + data zapisu; logika
  łączenia składu z pulą w nowym czystym module `src/lib/` z testem Vitest; zero zaczepów pod
  S-05/S-06 (czysty odczyt); `/teams/[id]/embark` zostaje bez zmian, dostaje tylko linki nawigacyjne.
- Bez migracji bazy: `select` dla właściciela i kolumny `composition` / `created_at` istnieją
  od `20260905185700_teams_schema.sql`.
