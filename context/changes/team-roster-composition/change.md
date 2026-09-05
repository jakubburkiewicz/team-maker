---
change_id: team-roster-composition
title: Kompletowanie składu drużyny z okna wyboru członka
status: implementing
created: 2026-09-05
updated: 2026-09-05
---

## Notes

- Element mapy drogowej: **S-01** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień A).
- Wymaganie wstępne: F-02 (`solvable-character-pool`, zarchiwizowane 2026-09-05) — pula
  `PoolCharacter[]` jest w bazie i dostępna przez `getCharacterPool` w `src/lib/character-pool-repo.ts`.
- Odblokowuje: S-02 (`competency-radar-gate`).
- Pierwszy ekran domenowy projektu i pierwsza wyspa React ze stanem domenowym. Bez perków,
  wykresu i zapisu — to S-02 i S-03.
- Rozstrzyga niewiadomą zapisaną przy S-01: **kompletowana drużyna żyje wyłącznie w pamięci
  wyspy** i nie przeżywa odświeżenia strony — decyzja użytkownika z sesji planowania 2026-09-05,
  spójna z Non-Goalem „wersje robocze niedomkniętych drużyn".
- Zamyka martwy punkt z przeglądu F-02 („nie sprawdzono, jak S-01 obsłuży stan błędu strony"):
  strona `/teams/new` łapie wyjątek z repo i renderuje stan błędu zamiast wyspy.
