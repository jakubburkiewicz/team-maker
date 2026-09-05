---
change_id: competency-radar-gate
title: Wybór perków, wykres pajęczynowy i blokada progu
status: archived
created: 2026-09-05
updated: 2026-09-05
archived_at: 2026-09-05T16:17:40Z
---

## Notes

- Element mapy drogowej: **S-02** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień A).
- Wymaganie wstępne: S-01 (`team-roster-composition`, zarchiwizowane 2026-09-05) — wyspa
  `TeamComposer` na `/teams/new` trzyma `composition: TeamComposition` w pamięci, a skład rośnie
  i maleje wyłącznie przez `addMember` / `removeMember` z `src/lib/domain/roster.ts`.
- Odblokowuje: S-03 (`first-saved-team`, gwiazda przewodnia) i S-08 (`missing-points-counter`).
- Pierwszy konsument `evaluateTeam` poza testami. Bez zapisu, tabeli `teams` i trasy API — to S-03.
- Rozstrzyga niewiadomą zapisaną przy S-02 („jak narysować wykres pajęczynowy bez dokładania
  ciężkiej zależności"): **ręczny inline SVG** z czystym helperem geometrii w `src/lib/`, zero
  nowych zależności — decyzja użytkownika z sesji planowania 2026-09-05.
- Decyzje UX z sesji planowania 2026-09-05: perki wybiera się na karcie zajętego slotu (okno
  wyboru zostaje tylko do odczytu); trzeci perk przy 2/2 jest wyłączony; układ dwukolumnowy
  (skład | wykres + przycisk); etykieta przycisku po angielsku — „Embark on the job" jako
  odpowiednik „Wyrusz na zlecenie" z PRD; odblokowany przycisk w S-02 nie ma handlera.
- Domyka dług F6 z przeglądu S-01: wariant `cosmic` w `buttonVariants` zamiast czwartej kopii
  ciągu klas CTA.
