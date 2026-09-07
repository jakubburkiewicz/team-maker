---
change_id: 2026-09-07-test-plan-refresh
title: Refresh test-plan.md — runtime test-purity rule and Postgres-free isolation response
status: planned
created: 2026-09-07
updated: 2026-09-07
archived_at: null
---

## Notes

Open a change folder for a REFRESH of context/foundation/test-plan.md (not a rollout phase).

Trigger: a hard rule the guide quotes verbatim was rewritten today in AGENTS.md
(commit 62a6f68, landed with Phase 1 research). The test-purity rule moved from a
textual criterion ("nothing under test may import astro:* or @/lib/supabase") to a
runtime criterion ("what evaluates at test time"). The guide still carries the old
letter, and §4 still calls the resulting question open when it has been answered.

Scope of this refresh — five corrections, all sourced from
context/changes/2026-09-07-testing-save-barrier/research.md:

1. §4 Stack, "Ograniczenia twarde" paragraph — replace the quoted purity rule with the
   current AGENTS.md criterion: what evaluates at test runtime, not what an import line
   says. `import type` from "astro" and `node:fs` are explicitly fine; a file importing
   @/lib/supabase can be under test when the test replaces that module via a hoisted
   vi.mock; building a real client in a test stays forbidden.
2. §4 Stack, row "integration (trasy, baza)" — the note "Wymaga rozstrzygnięcia, jak
   pogodzić wykonanie z regułą czystości testów" is resolved, not open. Restate what the
   resolution is and what it unblocks.
3. §2 Risk Response Guidance, row #1 — drop "jak pogodzić test wykonawczy z regułą
   czystości testów z AGENTS.md" from the "context research must ground" cell; that
   context is now grounded.
4. §2 Risk Response Guidance, row #2 — "likely cheapest layer" currently reads
   "integracja przeciwko prawdziwemu Postgresowi (dwie tożsamości)". Research established
   real Postgres is out of CI reach: .github/workflows/ci.yml:21 runs bare `npm test`
   with no services, no env, no Docker; the local stack needs a manual `npx supabase start`
   and ~7 GB RAM. USER DECISION: keep risk #2 unchanged (the IDOR risk is real); reword the
   response — what can be proven without Postgres in CI, and what stays a local/manual smoke.
   This also touches §3 Phase 2's goal line and §5 gate "integration na izolacji".
5. §2 Risk #1 wording — research verified the "poza interfejsem" surface is narrower than
   the phrase suggests: SUPABASE_KEY is server-secret and never reaches the browser, so the
   real attack surface is a crafted HTTP request to the app's own route carrying a valid
   session cookie, not a direct PostgREST write. Narrow the risk wording accordingly.

Also worth carrying (research §_Historical Context_): the archive entry
2026-09-06-cross-account-team-isolation/plan.md:56-58 asserts "Dowodu nie ma… izolacji
cross-account nie da się zautomatyzować w Vitest". That premise no longer holds, and §3
Phase 2 was scoped under it.

Out of scope — do NOT change:
- The six risks in §2 themselves. User confirmed: same risks, only the response got cheaper.
- §7 negative space. User confirmed all five exclusions still hold.
- §1 Strategy, §3 phase ordering, §6 cookbook placeholders.
- Hot-spot citations in §2 — rescanned today over src/ + supabase/migrations/ (52 commits/30d):
  src/lib 47, src/components/team 39, src/lib/domain 24, src/pages/teams 19,
  src/pages/api/teams 8, supabase/migrations 6. Unchanged; the evidence still stands.

Sequencing constraint (user decision): rollout Phase 1
(context/changes/2026-09-07-testing-save-barrier/, status `researched`) is WAITING on this
refresh. Its /10x-plan must run against the corrected §2/§4, not the stale ones. Do not
start Phase 1 planning until this refresh lands.

One concern raised and declined as a separate risk row, to be carried as an anti-pattern
instead: a hand-written Supabase client fake can drift silently from real database
behavior, so a green vi.mock test is not by itself proof. §1's cross-cutting principle
already binds this — the disarm-variant must go red. Keep it in the anti-pattern column,
not as a seventh risk.
