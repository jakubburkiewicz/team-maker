# Dalsze działania z przeglądu implementacji S-04

Źródło: `context/changes/own-teams-list-and-detail/reviews/impl-review.md` (2026-09-06).
Pozycje odroczone świadomie w triażu — nie są długiem przypadkowym.

## Z F7 — wydzielić `src/lib/team-composition.ts`

- **Kiedy**: przy S-05 (`edit-saved-team`) albo S-06 (`delete-team-confirmed`) — pierwszej fazie,
  która doda trzeciego konsumenta umowy kształtu składu.
- **Co**: przenieść `toTeamComposition` i typ `TeamComposition` z `src/lib/team-submission.ts` do
  nowego `src/lib/team-composition.ts`; w `team-submission.ts` zostawić wyłącznie bramkę zapisu
  (`gateTeamSubmission`, `parseTeamComposition`). Zaktualizować import w `src/lib/team-repo.ts:4`.
- **Dlaczego nie teraz**: kształt refaktoru ustalą dopiero kolejni konsumenci, a docstring
  `team-submission.ts:13-16` do tego czasu niesie prawdę o podwójnej roli modułu.
- **Przed startem sprawdzić**: ile miejsc importuje dziś `TeamComposition` z `@/lib/team-submission`
  (martwy punkt przeglądu — nie policzono).

## Z F8 — potwierdzić, że produkcyjny `SUPABASE_KEY` to klucz anon

- **Kiedy**: pozycja kontrolna planu S-07 (`cross-account-team-isolation`).
- **Co**: sprawdzić w dashboardzie Supabase, że sekret ustawiony przez `npx wrangler secret put
  SUPABASE_KEY` to klucz anon/publishable, nie `service_role`.
- **Dlaczego**: `listTeams` i `getTeamDetail` celowo nie filtrują po `user_id` — własność egzekwuje
  wyłącznie polityka RLS `select`. Klucz `service_role` omija RLS w całości, więc `listTeams`
  zwróciłby drużyny wszystkich kont. Z kodu nie da się tego sprawdzić.
