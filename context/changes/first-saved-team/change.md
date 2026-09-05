---
change_id: first-saved-team
title: Zapis domkniętej drużyny z potwierdzeniem
status: planned
created: 2026-09-05
updated: 2026-09-05
---

## Notes

- Element mapy drogowej: **S-03** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień A) —
  **gwiazda przewodnia**: najmniejszy kompletny przepływ od interfejsu przez logikę po zapis.
- Wymaganie wstępne: S-02 (`competency-radar-gate`, zarchiwizowane 2026-09-05) — bramka „Embark on
  the job" w `src/components/team/EmbarkGate.tsx` odblokowuje się przy `evaluation.isValid`, ale nie
  ma handlera; skład żyje w pamięci wyspy `TeamComposer`.
- Odblokowuje: S-04 (`own-teams-list-and-detail`), a przez nie S-05, S-06, S-07.
- Pierwsza tabela z danymi użytkownika (`teams`) i pierwsza zmiana schematu po wdrożeniu na produkcję.
- Rozstrzyga niewiadomą zapisaną przy S-03 („z czego liczony jest hash nazwy i czy musi być unikalny
  w obrębie konta"): **losowa nazwa generowana w bazie** (`default` kolumny, 8 znaków hex z
  `gen_random_uuid()`), **unikalna per konto** (`unique (user_id, name)`) — decyzja użytkownika
  z sesji planowania 2026-09-05.
- Decyzje projektowe z sesji planowania 2026-09-05: skład w kolumnie `jsonb` jednej tabeli (edycja
  w S-05 atomowa z konstrukcji); próg egzekwowany w trasie API przez `evaluateTeam` na puli z bazy
  plus RLS na własność (bez duplikatu reguły w SQL — ryzyko bezpośredniego zapisu przez PostgREST
  przyjęte świadomie, bo `SUPABASE_KEY` jest sekretem serwera); natywny `<form method="POST">`
  z ukrytym polem JSON (konwencja repo, skład przepada przy awarii zapisu — przyjęte); potwierdzenie
  na osobnej stronie `/teams/[id]/embark` czytającej nazwę z bazy; nieznane lub cudze id → 404
  (prowizorycznie, S-07 może zrewidować); `supabase db push` jako ostatnia, ręczna faza zmiany.
