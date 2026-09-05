---
change_id: solvable-character-pool
title: Rozwiązywalna pula 10–12 postaci wraz z perkami
status: implemented
created: 2026-08-30
updated: 2026-09-05
---

## Notes

- Element mapy drogowej: **F-02** w `context/foundation/roadmap.md` (kamień milowy M-1).
- Wymaganie wstępne: F-01 (`domain-rule-verification-harness`, zarchiwizowane 2026-08-30) —
  kontrakt `Character`/`Perk`/`CharacterPool` i `evaluateTeam` już istnieją w `src/lib/domain/`.
- Odblokowuje: S-01 (`team-roster-composition`), S-02 (`competency-radar-gate`).
- Rozstrzyga obie „Niewiadome” zapisane przy F-02:
  - **Pula w bazie danych**, nie stałą w kodzie — decyzja użytkownika z sesji planowania
    2026-08-30, wbrew rekomendacji planu. Autorskim źródłem prawdy pozostaje plik danych w repo,
    z którego generowana jest migracja zasiewowa; inaczej wiążący dowód rozwiązywalności musiałby
    importować Supabase i złamać twardą regułę z `AGENTS.md`.
  - **Treść postaci generuje agent, po angielsku**, użytkownik recenzuje przed scaleniem —
    spójnie z istniejącą anglojęzyczną kopią interfejsu.
- Siedem kompetencji **zostaje przy nazwach roboczych** z F-01. Brief F-01 zostawiał tę decyzję
  tej zmianie; rozstrzygnięcie: bez zmian, `types.ts` nietknięte w tym zakresie.
- Faza 4 dotyka projektu produkcyjnego. `supabase config push` pozostaje zakazane
  (`AGENTS.md` → Hard rules); jedyną dozwoloną ścieżką jest `supabase db push`.
