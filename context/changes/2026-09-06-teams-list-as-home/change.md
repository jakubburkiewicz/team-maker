---
change_id: 2026-09-06-teams-list-as-home
title: Lista drużyn na stronie głównej zamiast dashboardu i osobnej trasy /teams
status: planned
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Z listy zmian zgłoszonych przez użytkownika — punkty 3, 4 i 5:

3. Aktualna zawartość strony głównej powinna zawierać listę drużyn, a nie stronę przykładową.
4. Po zmianie z pkt. 3 zawartość strony "Your teams" musi zostać dostosowana w kwestii
   przycisków do nowych warunków (będzie miała nagłówek).
5. Dashboard w ogóle nie powinien istnieć w formie oddzielnej strony.

### Rozstrzygnięte 2026-09-06

Punkt 4 znaczy: treść z `/teams` **przenosi się** na `/`, a nie zostaje obok niej.
Znikają obie trasy — `/dashboard` i `/teams` (indeks listy). Pozycja menu "Your teams"
z punktu 2 celuje w `/`. Zostają podtrasy `/teams/new` i `/teams/[id]`.

### Zakres w kodzie

- `src/pages/index.astro` — dziś tylko `<Welcome />`; przejmuje frontmatter i widok
  z `src/pages/teams/index.astro` (gałęzie: awaria odczytu / pusto / lista, baner `?deleted=1`).
- `src/pages/dashboard.astro`, `src/pages/teams/index.astro` — do usunięcia.
  Wraz z nimi znikają linki "← Back to dashboard" i przycisk "Back to dashboard" w gałęzi awarii
  (zastępuje je nagłówek z `2026-09-06-app-shell-header-nav`).
- `src/components/Welcome.astro` — osierocony po zmianie, do usunięcia.
- `src/pages/api/teams/[id]/delete.ts` — przekierowanie po usunięciu leci dziś na
  `/teams?deleted=1`; musi celować w `/?deleted=1`.
- `src/middleware.ts` — `PROTECTED_ROUTES` zawiera `/dashboard` (do usunięcia) i musi objąć `/`.
  **Uwaga:** dopasowanie działa przez `startsWith`, więc wpis `"/"` złapałby każdą trasę,
  w tym `/auth/signin` — pętla przekierowań. Potrzebne osobne dopasowanie dokładne.
- Sprawdzić pozostałe linki do `/dashboard` i `/teams` (m.in. `src/pages/teams/[id]/embark.astro`,
  `src/components/team/*`).

Powiązane zmiany: `2026-09-06-app-shell-header-nav`, `2026-09-06-team-action-buttons`.
