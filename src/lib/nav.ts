/**
 * Pozycje menu powłoki i reguła „która pozycja odpowiada bieżącej ścieżce".
 *
 * Reguła mieszka tutaj, a nie w `src/components/AppHeader.astro`, bo nic pod testem nie może
 * wciągać `astro:*` ani `@/lib/supabase` (AGENTS.md → Hard rules). `.astro` zostaje wtedy samym
 * markupem, a jedyna logika tej zmiany jest objęta Vitestem.
 *
 * Bliźniacza reguła dla ochrony tras żyje w `src/lib/routes.ts` — ten sam podział na dopasowanie
 * dokładne i po granicy segmentu, z tego samego powodu.
 */

/** Jak pozycja dopasowuje się do ścieżki. Tryb jest własnością **pozycji**, nie algorytmu. */
export type NavMatch = "exact" | "prefix";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly match: NavMatch;
}

/**
 * Menu powłoki w kolejności wyświetlania.
 *
 * `Your teams` celuje w korzeń i musi być dopasowane przez **równość**: `"/teams/new".startsWith("/")`
 * jest prawdą, więc prefiks podświetlałby tę pozycję na każdym ekranie aplikacji. To ta sama pułapka,
 * którą `src/lib/routes.ts` odnotowuje przy `EXACT_ROUTES`.
 *
 * `Sign out` **nie jest** pozycją tej listy: to `<form method="POST" action="/api/auth/signout">`,
 * nie link, więc nie ma `href` do dopasowania i nie może nigdy być aktywny. Żyje w markupie nagłówka.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Your teams", href: "/", match: "exact" },
  { label: "New team", href: "/teams/new", match: "prefix" },
];

/**
 * Ścieżka bez końcowego ukośnika — poza samym korzeniem, który ukośnikiem **jest**.
 *
 * `astro.config.mjs` nie ustawia `trailingSlash`, więc do dopasowania przyjdzie zarówno
 * `/teams/new`, jak i `/teams/new/`.
 */
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
}

/** Czy pozycja menu odpowiada bieżącej ścieżce. Funkcja czysta — bez `astro:*` i bez Supabase. */
export function isActiveNavItem(item: NavItem, pathname: string): boolean {
  const path = normalize(pathname);
  const href = normalize(item.href);

  if (item.match === "exact") {
    return path === href;
  }

  // Granica segmentu, a nie goły prefiks: inaczej hipotetyczne `/teams/newton` podświetliłoby
  // „New team".
  return path === href || path.startsWith(`${href}/`);
}
