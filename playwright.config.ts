import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja e2e — minimum potrzebne, by `e2e/seed.spec.ts` dało się uruchomić.
 *
 * Warstwa e2e jest w `context/foundation/test-plan.md` §4 wpisana jako „none yet — see Phase 4",
 * więc to jest **rusztowanie pod seed test**, nie rozstrzygnięcie Fazy 4. Kiedy Faza 4 ruszy,
 * to ona domyka `webServer`, projekt `setup` ze `storageState` i miejsce e2e w CI.
 *
 * Serwera **nie** startujemy stąd (brak `webServer`) i to jest decyzja, nie brak: `npm run build`
 * jest jedynym krokiem wymagającym sekretów Supabase (AGENTS.md), a te w `.env` wskazują dziś
 * projekt **hostowany**, gdzie potwierdzanie adresu jest włączone. Seed ma być uruchamiany
 * świadomie przeciwko wybranemu stosowi — patrz nagłówek `e2e/seed.spec.ts`.
 */
export default defineConfig({
  testDir: "./e2e",
  // Testy są niezależne (żaden nie zakłada danych innego), więc równoległość jest bezpieczna
  // i zarazem wymusza tę niezależność — współdzielony stan czerwieni się tu, a nie u recenzenta.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
