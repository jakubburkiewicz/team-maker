---
change_id: delete-team-confirmed
title: Usunięcie drużyny po potwierdzeniu w oknie dialogowym
status: implemented
created: 2026-09-06
updated: 2026-09-06
---

## Notes

- Element mapy drogowej: **S-06** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień B —
  pętla CRUD nad zapisaną drużyną). Domyka **D** z CRUD, a tym samym całą czwórkę operacji
  wymaganą przez pierwsze Kryterium sukcesu PRD.
- Wymaganie wstępne: S-04 (`own-teams-list-and-detail`, zarchiwizowane 2026-09-06) — lista `/teams`
  ze stanem pustym i widok `/teams/[id]`. Prowadzone po S-05 (`edit-saved-team`, zarchiwizowane
  2026-09-06), które dołożyło politykę `update` i wzorzec drugiego pisarza.
- Odnośniki PRD: US-03, FR-010, Non-Goal „kosz i przywracanie usuniętych drużyn”.
- Domyka zobowiązanie zapisane w `supabase/migrations/20260905185700_teams_schema.sql:12-14`
  („polityki update/delete dokładają S-05 i S-06 własnymi migracjami — razem z `grant update` /
  `grant delete`”) oraz rozbraja granicę zakresu S-05 zapisaną jako czerwony test
  `src/lib/teams-policy-sql.test.ts:77-82`.
- Wiążąca lekcja: `context/foundation/lessons.md` §„Po `npx shadcn add` popraw importy na pakiety
  per-prymityw” — wymienia `alert-dialog` w S-06 wprost.
- Decyzje projektowe z sesji planowania 2026-09-06:
  - Przycisk usuwania **tylko** na `/teams/[id]` — strona ma już `client:load`, więc nie powstaje
    nowa granica hydratacji; `/teams/index.astro` zostaje czystym SSR.
  - Okno potwierdzenia na prymitywie shadcn **`alert-dialog`** (`role="alertdialog"`, brak
    zamykania kliknięciem w tło) — nie na istniejącym `dialog.tsx`.
  - Trasa: nowy plik `src/pages/api/teams/[id]/delete.ts` z `export const POST` — natywny formularz
    nie zna czasownika DELETE, a rozgałęzianie istniejącego `POST /api/teams/[id]` po ukrytym polu
    przepuściłoby usuwanie przez bramkę progu.
  - Sukces → `/teams?deleted=1`; odmowa → `/teams/<id>?error=…` (istniejący slot `<ServerError>`).
  - `deleteTeam` ma trójwynikowy kontrakt `TeamSummary | null | throw`, identyczny z `updateTeam`.
  - Baner `?deleted=1` renderuje się nad stanem pustym **i** nad listą, nie nad gałęzią awarii —
    usunięcie ostatniej drużyny kończy się stanem pustym i tam potwierdzenie jest niezbędne.
  - Przycisk usuwania w osobnej wyspie `DeleteTeamDialog`; `TeamComposer` nie dowiaduje się
    o usuwaniu.
- Wymaga migracji bazy: `20260905185700_teams_schema.sql:46` cofnął przywilej `delete` i nie ma
  polityki `for delete` — bez nowej migracji usunięcie przechodzi bez błędu i kasuje **zero** wierszy.
