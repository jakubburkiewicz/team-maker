import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FullConfig } from "@playwright/test";

/**
 * STRAŻNIK STOSU — `globalSetup` odmawiający przebiegu e2e przeciwko czemukolwiek innemu
 * niż lokalny stos Supabase.
 *
 * Powód istnienia: odkąd `playwright.config.ts` sam startuje aplikację (`webServer`), nikt już
 * świadomie nie wybiera stosu przed przebiegiem. Bez strażnika pierwszy przebieg na drzewie
 * z produkcyjnym `.env` zakładałby konta w **projekcie hostowanym** — nieusuwalne, z realnym
 * listem i limitem SMTP. Strażnik jest tym, co czyni ten przebieg niemożliwym, a nie tylko
 * niezalecanym.
 *
 * Dwa fakty, których z kodu nie widać, a które kształtują ten plik:
 *
 * 1. **`globalSetup` biegnie PO `webServer`.** `createGlobalSetupTasks` wykonuje najpierw
 *    `createPluginSetupTasks` (tam żyje `webServer`), a dopiero potem pliki `globalSetup`
 *    (`node_modules/playwright/lib/runner/index.js:6321-6326`). Strażnik zatrzymuje więc
 *    **testy**, nie **start aplikacji**. Jest to nieszkodliwe: postawienie `npm run preview`
 *    niczego nie zapisuje do żadnego projektu — pierwsze żądanie do Supabase wysyła dopiero test.
 *    Kolejność nie jest błędem do „naprawienia".
 *
 * 2. **Sprawdzane są DWA pliki zmiennych, nie jeden.** Plugin Cloudflare wypieka
 *    `dist/server/.dev.vars` jako asset builda (`@cloudflare/vite-plugin/dist/index.mjs:53072`),
 *    a wrangler czyta ten plik w chwili preview (`:48466`). Preview serwuje więc wartości
 *    **zamrożone w chwili builda**, nie bieżącą treść `.env`. Strażnik czytający sam `.env`
 *    byłby zielony na rozbrojonym stanie: `.env` lokalny, build z hostowanego, testy lecą
 *    w produkcję. Stąd odmowa #3 — i stąd kolejność `.env` → `npm run build` → `npx playwright test`.
 *
 * Do tego odmowa #1: root `.dev.vars` **wyłącza** `.env`, nie uzupełnia go
 * (`wrangler/wrangler-dist/cli.js:297455` — `getVarsForDev` czyta `.env` wyłącznie wtedy, gdy
 * `.dev.vars` nie istnieje). Obecność tego pliku znaczy, że nie wiadomo, co aplikacja wczytała.
 *
 * **Odmowa #5 jest dopiskiem z implementacji, nie z umowy planu** (plan wylicza cztery).
 * Sonda 2026-09-09: przy `E2E_BASE_URL` wskazującym obcy, odpowiadający serwer strażnik
 * przepuszczał przebieg, a `reuseExistingServer` reużywał ten serwer — cztery odmowy pilnują
 * **łańcucha zmiennych Supabase**, żadna nie pilnuje **adresu, w który testy celują**. Dziś to
 * foot-gun, po dołożeniu fixture'u zakładającego konto (Faza 2) byłaby to droga do rejestracji
 * w produkcyjnej bazie. Numeracja 1–4 zostaje nietknięta, bo cytują ją kryteria planu.
 *
 * Pięć odmów jest rozłącznych i sprawdzanych w tej kolejności; każda mówi, **co zrobić**.
 *
 * **Czego strażnik nie widzi** (żeby nikt nie czytał go jako szczelnego): sprawdza pliki
 * zmiennych i adres, nie to, co faktycznie siedzi w gnieździe na porcie aplikacji. Obcy proces
 * nasłuchujący na `localhost:4321` zostanie przez `reuseExistingServer` reużyty i strażnik tego
 * nie zauważy. Pokryte jest reużycie `npm run preview` — czyta ten sam plik, co odmowa #3.
 */

const LOCAL_STACK_ORIGIN = "http://127.0.0.1:54321";
const HEALTH_URL = `${LOCAL_STACK_ORIGIN}/auth/v1/health`;
const HEALTH_TIMEOUT_MS = 5_000;

const ROOT_DEV_VARS = ".dev.vars";
const ENV_FILE = ".env";
const BUILT_DEV_VARS = "dist/server/.dev.vars";

/**
 * Parser `KEY=VALUE` — dwie linie, więc bez nowej zależności (`dotenv` nie wchodzi).
 * Obcina cudzysłowy (build zapisuje wartości w apostrofach) i pomija komentarze oraz puste linie.
 */
function readVars(path: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    vars.set(key, value);
  }
  return vars;
}

/** Lokalny stos to port 54321 na pętli zwrotnej — `npx supabase status` podaje go w obu zapisach. */
function isLocalStack(url: string | undefined): boolean {
  if (url === undefined || url === "") {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.port === "54321" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  } catch {
    return false;
  }
}

/** Adres testowany musi leżeć na pętli zwrotnej — wdrożony worker i tunel są tu poza zasięgiem. */
function isLoopbackTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

/** Do komunikatów trafia wyłącznie host — sekret (`SUPABASE_KEY`) nie jest nigdzie wypisywany. */
function describeHost(url: string | undefined): string {
  if (url === undefined || url === "") {
    return "(brak SUPABASE_URL)";
  }
  try {
    return new URL(url).host;
  } catch {
    return "(niepoprawny URL)";
  }
}

async function isStackHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return response.status === 200;
  } catch {
    return false;
  }
}

const stackGuard: (config: FullConfig) => Promise<void> = async (config) => {
  const repoRoot = resolve(import.meta.dirname, "..");

  // ——— Odmowa #1: root `.dev.vars` przesłania `.env` ———
  if (existsSync(resolve(repoRoot, ROOT_DEV_VARS))) {
    throw new Error(
      `E2E odmawia startu: w korzeniu repozytorium leży ${ROOT_DEV_VARS}.\n` +
        `Ten plik WYŁĄCZA .env (wrangler nie scala obu), więc nie wiadomo, z jakim stosem zbudowano aplikację.\n` +
        `Usuń ${ROOT_DEV_VARS} i ustaw stos w ${ENV_FILE} — to jedyny sankcjonowany przełącznik (AGENTS.md).`,
    );
  }

  // ——— Odmowa #2: `.env` nie wskazuje lokalnego stosu ———
  const envPath = resolve(repoRoot, ENV_FILE);
  const envUrl = existsSync(envPath) ? readVars(envPath).get("SUPABASE_URL") : undefined;
  if (!isLocalStack(envUrl)) {
    throw new Error(
      `E2E odmawia startu: ${ENV_FILE} nie wskazuje lokalnego stosu Supabase (SUPABASE_URL → ${describeHost(envUrl)}).\n` +
        `E2E nigdy nie biegnie przeciwko projektowi hostowanemu — zakładałoby tam nieusuwalne konta i wysyłało realne listy.\n` +
        `Ustaw w ${ENV_FILE}: SUPABASE_URL=${LOCAL_STACK_ORIGIN} oraz SUPABASE_KEY na klucz anon z \`npx supabase status\`,\n` +
        `a potem uruchom \`npm run build\` — dopiero build przenosi te wartości do aplikacji.`,
    );
  }

  // ——— Odmowa #3: build zamrożony na innym stosie ———
  const builtPath = resolve(repoRoot, BUILT_DEV_VARS);
  if (!existsSync(builtPath)) {
    throw new Error(
      `E2E odmawia startu: brak ${BUILT_DEV_VARS} — aplikacja nie została jeszcze zbudowana.\n` +
        `Preview serwuje wartości zamrożone w tym pliku, nie bieżącą treść ${ENV_FILE}.\n` +
        `Uruchom \`npm run build\`.`,
    );
  }
  const builtUrl = readVars(builtPath).get("SUPABASE_URL");
  if (!isLocalStack(builtUrl)) {
    throw new Error(
      `E2E odmawia startu: build jest zamrożony na innym stosie (${BUILT_DEV_VARS} → ${describeHost(builtUrl)}),\n` +
        `mimo że ${ENV_FILE} wskazuje już lokalny. Preview serwuje TEN plik, nie ${ENV_FILE}.\n` +
        `Uruchom \`npm run build\` po przestawieniu ${ENV_FILE}.`,
    );
  }

  // ——— Odmowa #4: lokalny stos nie odpowiada ———
  if (!(await isStackHealthy())) {
    throw new Error(
      `E2E odmawia startu: lokalny stos Supabase nie odpowiada (GET ${HEALTH_URL}).\n` +
        `Bez tej odmowy przebieg padłby w losowym miejscu z komunikatem o niczym.\n` +
        `Uruchom \`npx supabase start\`.`,
    );
  }

  // ——— Odmowa #5: testy celują poza pętlę zwrotną ———
  // Czytane z `config`, nie z `process.env`, bo adres można podać dwiema drogami: `E2E_BASE_URL`
  // i wprost w `playwright.config.ts`. Obie kończą się w `use.baseURL` projektu.
  for (const project of config.projects) {
    const target = project.use.baseURL;
    if (target !== undefined && !isLoopbackTarget(target)) {
      throw new Error(
        `E2E odmawia startu: projekt „${project.name}" celuje poza pętlę zwrotną (baseURL → ${describeHost(target)}).\n` +
          `Cztery odmowy wyżej pilnują łańcucha zmiennych, ale nie adresu — a testy zakładają konta tam, dokąd celują.\n` +
          `Zdejmij \`E2E_BASE_URL\` (domyślnie jest http://localhost:4321) albo ustaw je na adres lokalny.`,
      );
    }
  }
};

export default stackGuard;
