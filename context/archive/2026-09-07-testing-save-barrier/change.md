---
change_id: 2026-09-07-testing-save-barrier
title: Bariera serwerowa zapisu drużyny (test-plan, faza 1)
status: archived
created: 2026-09-07
updated: 2026-09-07
archived_at: 2026-09-07T16:50:12Z
---

## Notes

Faza 1 wdrożenia z `context/foundation/test-plan.md` §3.

- **Cel:** skład łamiący próg albo limity nie zostaje utrwalony, choćby żądanie ominęło interfejs.
- **Ryzyka pokrywane:** #1, #6.
- **Typy testów:** integration, contract.
- Faza domyka jedno z dwóch ryzyk High × High najtańszą warstwą, jaka może je udowodnić,
  i rozstrzyga strukturalne pytanie o pogodzenie testu wykonawczego z regułą czystości testów
  (`AGENTS.md`: nic pod testem nie może importować `astro:*` ani `@/lib/supabase`) — czym odblokowuje Fazę 2.
