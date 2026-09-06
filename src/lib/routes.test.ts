import { describe, expect, it } from "vitest";

import { isProtectedRoute } from "@/lib/routes";

/**
 * Czy reguła ochrony tras (FR-004) chroni dokładnie to, co ma chronić.
 *
 * Ścieżki są tu **literałami**, nie odczytami ze stałych modułu — asercja wyrażona przez pinowaną
 * stałą podąża za jej mutacją i przestaje cokolwiek wiązać (ten sam wzorzec co
 * `src/lib/missing-competencies.test.ts`).
 *
 * Sednem jest pułapka dopasowania korzenia: `/` chronione **przez równość**, bo dopasowanie
 * prefiksowe złapałoby też `/auth/signin` i dało pętlę przekierowań na własnym ekranie logowania.
 * Ta awaria nie objawia się ani w lincie, ani w typach, ani w buildzie — wyłącznie w przeglądarce.
 */

const TEAM_ID = "8f3c1d2e-4a5b-6c7d-8e9f-0a1b2c3d4e5f";

describe("isProtectedRoute — trasy chronione", () => {
  it("strona główna z listą drużyn wymaga zalogowania", () => {
    expect(isProtectedRoute("/")).toBe(true);
  });

  it("wszystkie trasy drużyn wymagają zalogowania", () => {
    expect(isProtectedRoute("/teams")).toBe(true);
    expect(isProtectedRoute("/teams/new")).toBe(true);
    expect(isProtectedRoute(`/teams/${TEAM_ID}`)).toBe(true);
    expect(isProtectedRoute(`/teams/${TEAM_ID}/embark`)).toBe(true);
    // `trailingSlash` zostaje domyślne („ignore"), więc wzorce tras kończą się `\/?$` i `/teams/new/`
    // jest realnie osiągalna — dopasowanie prefiksu musi ją łapać tak samo jak wersję bez ukośnika.
    expect(isProtectedRoute("/teams/new/")).toBe(true);
  });

  it("trasy API drużyn wymagają zalogowania", () => {
    expect(isProtectedRoute("/api/teams")).toBe(true);
    expect(isProtectedRoute(`/api/teams/${TEAM_ID}/delete`)).toBe(true);
  });
});

describe("isProtectedRoute — pułapka dopasowania korzenia", () => {
  it("ekrany uwierzytelniania są otwarte, inaczej logowanie odbijałoby na samo siebie", () => {
    expect(isProtectedRoute("/auth/signin")).toBe(false);
    expect(isProtectedRoute("/auth/signup")).toBe(false);
    expect(isProtectedRoute("/auth/confirm-email")).toBe(false);
  });

  it("trasy API uwierzytelniania są otwarte — bez nich nie da się zalogować ani wylogować", () => {
    expect(isProtectedRoute("/api/auth/signin")).toBe(false);
    expect(isProtectedRoute("/api/auth/signout")).toBe(false);
  });
});

describe("isProtectedRoute — trasy niechronione", () => {
  it("skasowany dashboard nie jest chroniony, bo trasa nie istnieje", () => {
    expect(isProtectedRoute("/dashboard")).toBe(false);
  });

  it("prefiks dopasowuje się po granicy segmentu, a nie po znakach", () => {
    expect(isProtectedRoute("/teamsomething")).toBe(false);
    expect(isProtectedRoute("/api/teamsomething")).toBe(false);
  });
});
