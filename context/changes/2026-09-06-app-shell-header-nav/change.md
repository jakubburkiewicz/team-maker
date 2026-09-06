---
change_id: 2026-09-06-app-shell-header-nav
title: Wspólny nagłówek z użytkownikiem i menu nawigacyjnym na każdej stronie
status: planned
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Z listy zmian zgłoszonych przez użytkownika — punkty 1 i 2:

1. Każda strona powinna mieć nagłówek, jak na aktualnej stronie głównej, z nazwą
   zalogowanego użytkownika oraz menu nawigacyjnym po widokach.
2. Menu powinno zawierać "Your teams", "New team", "Sign out".

Dziś nagłówek żyje w `src/components/Topbar.astro` i jest używany tylko na wybranych
stronach; brak wspólnej powłoki (layoutu) obejmującej `teams/*`.

Powiązane zmiany: `2026-09-06-teams-list-as-home` (znika `/dashboard`, więc menu nie może
do niego linkować), `2026-09-06-team-action-buttons`.
