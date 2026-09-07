import { describe, expect, it } from "vitest";

import { isActiveNavItem, NAV_ITEMS, type NavItem } from "@/lib/nav";

/**
 * Czy wyróżniona pozycja menu odpowiada ekranowi, na którym gracz stoi — ze szczególnym naciskiem
 * na pułapkę dopasowania korzenia (`"/cokolwiek".startsWith("/")` jest prawdą).
 *
 * Ścieżki i pozycje są tu **literałami**, nie odczytami z `NAV_ITEMS` — asercja wyrażona przez
 * pinowaną stałą podąża za jej mutacją i przestaje cokolwiek wiązać
 * (wzorzec z `src/lib/missing-competencies.test.ts`). Kształt samej stałej wiąże osobny opis niżej,
 * więc rozjazd między literałami a listą aplikacji czerwieni się głośno.
 */
const YOUR_TEAMS: NavItem = { label: "Your teams", href: "/", match: "exact" };
const NEW_TEAM: NavItem = { label: "New team", href: "/teams/new", match: "prefix" };

// Ścieżka dynamiczna, którą aplikacja realnie serwuje (`src/pages/teams/[id].astro`,
// `src/pages/teams/[id]/embark.astro`).
const TEAM_ID = "3f1c9a52-8b7d-4e21-9c0a-6d5e4f3b2a10";

describe("isActiveNavItem — ekran główny", () => {
  it("na / wyróżnia pozycję Your teams", () => {
    expect(isActiveNavItem(YOUR_TEAMS, "/")).toBe(true);
  });

  it("na / nie wyróżnia pozycji New team", () => {
    expect(isActiveNavItem(NEW_TEAM, "/")).toBe(false);
  });
});

describe("isActiveNavItem — pułapka dopasowania korzenia", () => {
  it("Your teams NIE jest wyróżnione na /teams/new", () => {
    // Ta asercja jest sednem trybu `exact`: prefiksowe `startsWith("/")` podświetliłoby
    // Your teams na każdym ekranie aplikacji.
    expect(isActiveNavItem(YOUR_TEAMS, "/teams/new")).toBe(false);
  });

  it("Your teams NIE jest wyróżnione na ekranie zapisanej drużyny", () => {
    expect(isActiveNavItem(YOUR_TEAMS, `/teams/${TEAM_ID}`)).toBe(false);
  });

  it("Your teams NIE jest wyróżnione na potwierdzeniu zapisu", () => {
    expect(isActiveNavItem(YOUR_TEAMS, `/teams/${TEAM_ID}/embark`)).toBe(false);
  });
});

describe("isActiveNavItem — kompletowanie drużyny", () => {
  it("na /teams/new wyróżnia pozycję New team", () => {
    expect(isActiveNavItem(NEW_TEAM, "/teams/new")).toBe(true);
  });

  it("końcowy ukośnik nie zmienia werdyktu żadnej pozycji", () => {
    // `astro.config.mjs` nie ustawia `trailingSlash`, więc przyjdzie i `/teams/new`, i `/teams/new/`.
    expect(isActiveNavItem(NEW_TEAM, "/teams/new/")).toBe(true);
    expect(isActiveNavItem(YOUR_TEAMS, "/teams/new/")).toBe(false);
  });

  it("tryb exact też znosi końcowy ukośnik", () => {
    // Sonda mutacyjna (2026-09-07) pokazała, że w trybie `prefix` normalizacja jest niewidoczna:
    // `"/teams/new/".startsWith("/teams/new/")` jest prawdą także bez niej, więc asercja wyżej
    // sama w sobie nie wiąże `normalize`. Wiąże ją dopiero tryb `exact`, gdzie porównanie jest
    // równością — i to jest tryb, którego normalizacja pilnuje dla każdej przyszłej pozycji.
    const exactItem: NavItem = { label: "Exact", href: "/teams/new", match: "exact" };

    expect(isActiveNavItem(exactItem, "/teams/new/")).toBe(true);
    expect(isActiveNavItem(exactItem, "/teams/new")).toBe(true);
    expect(isActiveNavItem(exactItem, "/teams/newton")).toBe(false);
  });

  it("/teams/newton NIE wyróżnia New team — dopasowanie idzie po granicy segmentu", () => {
    expect(isActiveNavItem(NEW_TEAM, "/teams/newton")).toBe(false);
  });
});

describe("isActiveNavItem — ekrany bez własnej pozycji w menu", () => {
  it("na ekranie zapisanej drużyny żadna pozycja nie jest wyróżniona", () => {
    expect(isActiveNavItem(YOUR_TEAMS, `/teams/${TEAM_ID}`)).toBe(false);
    expect(isActiveNavItem(NEW_TEAM, `/teams/${TEAM_ID}`)).toBe(false);
  });

  it("na potwierdzeniu zapisu żadna pozycja nie jest wyróżniona", () => {
    expect(isActiveNavItem(YOUR_TEAMS, `/teams/${TEAM_ID}/embark`)).toBe(false);
    expect(isActiveNavItem(NEW_TEAM, `/teams/${TEAM_ID}/embark`)).toBe(false);
  });

  it("ekran logowania nie wyróżnia niczego — /auth/* nie wchodzi do powłoki", () => {
    expect(isActiveNavItem(YOUR_TEAMS, "/auth/signin")).toBe(false);
    expect(isActiveNavItem(NEW_TEAM, "/auth/signin")).toBe(false);
  });
});

describe("NAV_ITEMS — treść menu", () => {
  it("menu to dokładnie dwie pozycje: Your teams na / i New team na /teams/new", () => {
    // Jedyny automatyczny strażnik treści menu wobec punktu 2 zgłoszenia. `Sign out` celowo tu
    // nie występuje: to formularz POST, nie link, więc nie ma `href` do dopasowania.
    expect(NAV_ITEMS).toEqual([
      { label: "Your teams", href: "/", match: "exact" },
      { label: "New team", href: "/teams/new", match: "prefix" },
    ]);
  });

  it("żadna pozycja nie celuje w usunięte trasy /dashboard ani /teams", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).not.toBe("/dashboard");
      expect(item.href).not.toBe("/teams");
    }
  });
});
