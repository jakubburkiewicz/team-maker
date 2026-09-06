# Follow-upy z przeglądu implementacji (2026-09-06)

Źródło: `context/changes/delete-team-confirmed/reviews/impl-review.md`.

## F2 — bliźniacza poprawka w `src/pages/api/teams/[id].ts:37,44` (S-05, zarchiwizowane)

`const id = context.params.id ?? ""` trafia surowo do `reject()` → `Location`. Astro dekoduje
ścieżkę przed dopasowaniem trasy, więc `POST /api/teams/%0A` daje `params.id === "\n"`, a nowa linia
w nagłówku `Location` wywraca `new Response` — nieprzechwycony throw = 500 w Workerze (osiągalne
tylko przez zalogowanego użytkownika; bez open redirect). W `delete.ts` naprawione przez
`encodeURIComponent(context.params.id ?? "")` przy deklaracji `id`; to samo zrobić w `[id].ts`
(zmiana archiwum jest niemożliwa — kod naprawić w bieżącej lub następnej zmianie, np. S-07).
