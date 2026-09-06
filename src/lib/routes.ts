/**
 * Które ścieżki wymagają zalogowania (FR-004).
 *
 * Reguła mieszka tutaj, a nie w `src/middleware.ts`, bo middleware importuje `astro:middleware`,
 * a nic pod testem nie może wciągać `astro:*` (AGENTS.md → Hard rules). Bez tego wydzielenia
 * pułapka dopasowania korzenia opisana niżej byłaby nietestowalna z definicji.
 *
 * Egzekwuje ją dalej `src/middleware.ts` — to jest wyłącznie miejsce, w którym reguła jest
 * **zapisana**.
 */

// Trasy chronione przez dopasowanie **dokładne**.
//
// `/` musi być dopasowane przez równość: `"/auth/signin".startsWith("/")` jest prawdą,
// więc prefiks dałby pętlę przekierowań na własnym ekranie logowania.
const EXACT_ROUTES = ["/"];

// Trasy chronione wraz z podtrasami, dopasowane po **granicy segmentu**.
//
// Granica segmentu, a nie goły prefiks: inaczej hipotetyczne `/teamsomething` byłoby chronione
// bez powodu. Kosztuje jedno wyrażenie i domyka tę samą klasę pułapki co tryb dokładny.
const PREFIX_ROUTES = ["/teams", "/api/teams"];

/** Czy ścieżka wymaga zalogowanego gracza. Funkcja czysta — bez `astro:*` i bez Supabase. */
export function isProtectedRoute(pathname: string): boolean {
  return (
    EXACT_ROUTES.includes(pathname) ||
    PREFIX_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
