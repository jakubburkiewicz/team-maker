import { defineConfig, devices } from "@playwright/test";

/**
 * Konfiguracja e2e — `npx playwright test` na czystym drzewie sam stawia aplikację i sam
 * odmawia, gdy stos jest nie ten.
 *
 * **Serwer startuje stąd**: `webServer` uruchamia `npm run preview`, czyli **ten sam artefakt,
 * który jedzie na wdrożenie** — zbudowany worker na `workerd`, zminifikowane wyspy,
 * `import.meta.env.DEV` fałszywe. Test broni ścieżki **produkcyjnej** persony głównej, więc
 * wierność wdrożonemu runtime'owi jest tu wymaganiem, nie wygodą: to, co przejdzie na preview,
 * przejdzie u recenzenta. `npm run dev` serwuje inny artefakt (moduły źródłowe, gałęzie DEV)
 * i jego zieleń nie mówi nic o wdrożeniu.
 *
 * Rozjazd `/auth/confirm-email` (`src/pages/auth/confirm-email.astro:4` rozgałęzia treść na
 * `import.meta.env.DEV`) jest **dowodem tej klasy problemu, a nie całym powodem** — to jedyny
 * rozjazd dev/prod, który już udowodniono. Gdyby powodem był wyłącznie ten jeden ekran, pierwszy
 * czytelnik, który obejdzie go lokatorem odpornym na tryb, „zoptymalizowałby" konfigurację
 * z powrotem do `dev` i miałby rację wobec zapisanego powodu.
 *
 * **Build NIE jest częścią `webServer.command`** i to jest decyzja: gdyby `webServer` budował,
 * każdy przebieg płaciłby build, a strażnik straciłby swoją najostrzejszą odmowę („build
 * zamrożony na innym stosie") — build byłby zawsze świeży, kosztem cichego przemilczenia,
 * którego stosu dotyczył. Przepis brzmi `.env` → `npm run build` → `npx playwright test`.
 *
 * **Strażnik stosu** (`./e2e/stack-guard.ts`, `globalSetup`) odmawia przebiegu na pięć sposobów:
 * cztery pilnują **łańcucha zmiennych** (root `.dev.vars`, `.env`, `dist/server/.dev.vars`,
 * zdrowie stosu), piąty — **adresu, w który testy celują** (`baseURL` musi leżeć na pętli
 * zwrotnej). Piąty jest tu, bo cztery pierwsze przepuszczały `E2E_BASE_URL` na cudzy serwer,
 * który `reuseExistingServer` chętnie reużywa. Strażnik biegnie **po** starcie `webServer`
 * (tak działa Playwright — patrz komentarz w pliku strażnika), więc zatrzymuje testy, nie start
 * aplikacji; postawienie preview nic nikomu nie zapisuje.
 *
 * **Czego tu świadomie NIE ma**:
 * - `storageState` ani projektu `setup` — logowanie jest częścią **chronionej ścieżki**, którą
 *   ten test bada, nie osprzętem do przeskoczenia. `storageState` należy do testów, w których
 *   sesja jest tylko warunkiem wstępnym.
 * - miejsca w CI — e2e wymaga stosu Supabase (Dockera) na runnerze, a ta decyzja należy do
 *   Fazy 2 planu testów. Powód stoi w `context/foundation/test-plan.md` §5, przy osłabionym
 *   wierszu bramki; `ci.yml` zostaje nietknięty.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",
  // Testy są niezależne (żaden nie zakłada danych innego), więc równoległość jest bezpieczna
  // i zarazem wymusza tę niezależność — współdzielony stan czerwieni się tu, a nie u recenzenta.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  globalSetup: "./e2e/stack-guard.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // `reuseExistingServer: false` świadomie — odmowa #3 NIE pokrywa reużycia. Strażnik czyta
  // `dist/server/.dev.vars` z dysku, a stojący preview serwuje kompilację zamrożoną w chwili
  // *swojego* startu; te dwa stany rozjeżdżają się po każdym `npm run build`. Sonda 2026-09-10:
  // preview postawiony na buildzie wskazującym obcy projekt, potem `.env` → lokalny + rebuild —
  // wszystkie pięć odmów przeszło, a testy pobiegły przeciwko obcemu Supabase. Przy `false`
  // zajęty port jest głośną odmową Playwrighta zamiast cichego fałszywego przebiegu.
  webServer: {
    command: "npm run preview",
    url: BASE_URL,
    reuseExistingServer: false,
    // Hojnie, ale bez budowania: `dist/` jest już gotowe, więc preview wstaje w sekundach.
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
