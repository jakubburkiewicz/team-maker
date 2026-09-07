---
change_id: 2026-09-06-team-action-buttons
title: Ikonowe akcje na liście drużyn i uporządkowane akcje w edytorze
status: impl_reviewed
created: 2026-09-06
updated: 2026-09-07
archived_at: null
---

## Notes

Z listy zmian zgłoszonych przez użytkownika — punkty 6 i 7:

6. Każdy element listy drużyn musi zawierać przyciski: "Embark to the job", "Edit"
   i "Delete", przy czym wszystkie powinny być zrealizowane bez etykiet — zamiast nich
   powinny być ikonki.
7. Na stronie edycji drużyny brakuje przycisku "Embark to the job", a przycisk
   "Delete team" jest za bardzo wyrzucony poza kontekst.

Uwaga do treści zgłoszenia: pkt 6 mówi „dwa przyciski", ale wymienia trzy — przyjmujemy trzy.
Dostępność: przyciski bez etykiet potrzebują nazw dostępnych (`aria-label` / tooltip).

Dotyczy: strony głównej `/` (tam trafia lista — patrz `2026-09-06-teams-list-as-home`),
`src/pages/teams/[id].astro`,
`src/components/team/TeamComposer.tsx`, `src/components/team/DeleteTeamDialog.tsx`,
`src/pages/teams/[id]/embark.astro`.

Powiązane zmiany: `2026-09-06-teams-list-as-home` — lista drużyn **przenosi się** na `/`,
a `/teams` znika, więc jest tylko jedno miejsce z tymi akcjami (rozstrzygnięte 2026-09-06).
Oraz `2026-09-06-app-shell-header-nav`.
