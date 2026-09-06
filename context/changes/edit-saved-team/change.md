---
change_id: edit-saved-team
title: Edycja składu zapisanej drużyny
status: implementing
created: 2026-09-06
updated: 2026-09-06
---

## Notes

- Element mapy drogowej: **S-05** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień B —
  pętla CRUD nad zapisaną drużyną). Domyka **U** z CRUD.
- Wymaganie wstępne: S-04 (`own-teams-list-and-detail`, zarchiwizowane 2026-09-06) — lista `/teams`,
  widok `/teams/[id]` w trybie odczytu, `resolveSavedTeam` odcinające skład nie do złożenia z pulą.
- Odnośniki PRD: US-02, FR-009, FR-011, FR-018, Non-Goal „edycja nazwy drużyny”.
- Domyka dwa zobowiązania z przeglądu S-04: **F2** (przywrócić `client:load` na `/teams/[id]`)
  i **F5** (rozstrzygnąć, co wchodzi w miejsce po `EmbarkGate` w trybie edycji).
- Follow-up **F7** z przeglądu implementacji S-04 (wydzielić `src/lib/team-composition.ts`)
  **zostaje follow-upem** — decyzja przeglądu planu 2026-09-06 (F4). Martwy punkt tamtego przeglądu
  policzony: `toTeamComposition` ma **jednego** importera (`src/lib/team-repo.ts:4`) i pozostaje
  jedyny po S-05, bo trasa edycji bierze `gateTeamSubmission`, nie kształt.
- Decyzje projektowe z sesji planowania 2026-09-06:
  - `/teams/[id]` otwiera się **od razu edytowalne** — prop `readOnly` znika z `TeamComposer`
    w całości, więc para przełączników z `context/foundation/lessons.md` przestaje istnieć.
  - Zapis idzie przez nową trasę `POST /api/teams/[id]` (natywny formularz, `?error=`), nie PUT.
  - Po udanym zapisie redirect na `/teams/[id]?saved=1`; ekran `/teams/[id]/embark` zostaje
    wyłącznie potwierdzeniem **pierwszego** zapisu.
  - `EmbarkGate` → `CompositionGate`: jeden komponent, tryb sterowany obecnością propa `teamId`.
  - Niezmienność nazwy-hasha egzekwuje baza: kolumnowy `grant update (composition)`.
  - Brak jawnego „Discard changes” — skład żyje w pamięci wyspy, więc wyjście ze strony
    przywraca stan zapisany.
- Wymaga migracji bazy: `20260905185700_teams_schema.sql` cofnął `update` grantem i nie ma polityki
  `update` — bez nowej migracji zapis edycji zwróci zero wierszy.
