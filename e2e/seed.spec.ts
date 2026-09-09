import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { CHARACTER_POOL } from "@/lib/domain/character-pool";
import { findThresholdSolution } from "@/lib/domain/solvability";

/**
 * SEED TEST — wzorzec, z którego agent czyta konwencje e2e tego repozytorium.
 *
 * Playwright Planner/Generator traktuje ten plik jako przykład **wszystkich** generowanych
 * testów: co tu stoi, to dostaniesz z powrotem. Cztery wzorce, które ten plik demonstruje:
 *
 * 1. **Lokatory po rolach.** Wyłącznie `getByRole` / `getByLabel`. Ani jednego selektora CSS,
 *    XPath ani `getByTestId` — zero atrybutów testowych w `src/`, więc zero pokusy.
 * 2. **Czekanie na stan, nigdy na czas.** `waitForURL`, `toBeVisible`, `toHaveAttribute`,
 *    `toHaveCount`. `page.waitForTimeout()` nie pojawia się tu ani razu i nie ma się pojawić
 *    w niczym wygenerowanym.
 * 3. **Niezależność i sprzątanie.** Pełny cykl w jednym teście: setup → akcja → asercja →
 *    cleanup, plus `afterEach` jako siatka bezpieczeństwa na wypadek padu przed cleanupem.
 * 4. **Asercja powiązana z ryzykiem.** Nazwa testu cytuje ryzyko z
 *    `context/foundation/test-plan.md`, a asercja pada dokładnie wtedy, gdy to ryzyko się
 *    zmaterializuje.
 *
 * **Ryzyko #4** (`test-plan.md` §2): „Recenzent nie domyka ścieżki rejestracja → potwierdzenie
 * adresu → logowanie i ocenia produkt, do którego nie wszedł". Dowodem ochrony jest wedle
 * §2 Risk Response Guidance: „gracz **przechodzi logowanie i dociera do zapisanej drużyny** —
 * cała ścieżka persony głównej w jednym przebiegu".
 *
 * **Granica automatu.** Testy pokrywają dwa człony ścieżki persony głównej: (1) rejestracja
 * prowadzi na produkcyjnie wierny ekran potwierdzenia i **daje widoczną drogę dalej** do
 * logowania; (2) tor po potwierdzeniu adresu — od logowania w dół.
 *
 * Czego **nie** pokrywają i nie pokryją: tego, że recenzent po rejestracji ląduje
 * **wylogowany** i że kliknięcie linku z listu też go nie loguje. Lokalny stos ma
 * `GOTRUE_MAILER_AUTOCONFIRM=true` wpieczone w kontener, więc rejestracja tutaj **loguje**
 * (oddaje dwa ciasteczka `sb-`), a w produkcji nie. Asercja na tym byłaby fałszywym dowodem.
 * Ten człon należy do dymu: `scripts/smoke-reviewer-path.sh`.
 *
 * Logowanie stoi **w ciele testu**, a nie w `storageState`: tutaj jest częścią chronionej
 * ścieżki, nie osprzętem. W testach, gdzie sesja jest tylko warunkiem wstępnym, należy sięgnąć
 * po `storageState` — nie kopiować stąd logowania.
 *
 * **Uruchomienie** — aplikację stawia `playwright.config.ts` (`webServer` na `npm run preview`),
 * ale stos wybierasz **przed** buildem. Kolejność trzech kroków jest częścią przepisu, nie
 * sugestią: preview serwuje wartości **zamrożone w chwili builda** (`dist/server/.dev.vars`),
 * więc build po przestawieniu `.env`, nigdy przed. Złamanie kolejności kończy się odmową
 * strażnika `e2e/stack-guard.ts`, nie cichym przebiegiem w projekt hostowany.
 *
 * ```bash
 * npx supabase start                       # 1. lokalny stos (e2e nie biegnie przeciwko innemu)
 * # 2. .env → SUPABASE_URL=http://127.0.0.1:54321 + SUPABASE_KEY = klucz anon z `npx supabase status`
 * #    NIGDY nie twórz `.dev.vars` w korzeniu — ten plik WYŁĄCZA `.env`, nie uzupełnia go
 * npm run build                            # 3. dopiero build przenosi te wartości do aplikacji
 * npx playwright test                      # bez ani jednej zmiennej podanej z ręki
 * ```
 *
 * Pełna wersja przepisu żyje w `context/foundation/test-plan.md` §6.6.
 */

/**
 * Skład domykający próg liczy **reguła domenowa**, nie literał przepisany z ekranu.
 * `findThresholdSolution` jest tu wyłącznie nawigacją po łamigłówce (setup), nigdy wyrocznią
 * asercji — wyrocznią jest trwałość drużyny, patrz asercje niżej. Solver jest deterministyczny,
 * a `character-pool-sql.test.ts` pilnuje, że migracja zasiewowa jest obrazem tej samej stałej,
 * więc pula na ekranie i pula tutaj to jedna pula.
 */
const SOLUTION = findThresholdSolution(CHARACTER_POOL);

interface Account {
  email: string;
  password: string;
}

/**
 * Konto testowe — **osprzęt, nigdy wyrocznia**.
 *
 * Lokalny stos autopotwierdza adres, więc konto gotowe do logowania kosztuje jedno żądanie.
 * Unikalny adres na przebieg jest tym, co czyni równoległe przebiegi i ponowienia bezkolizyjnymi —
 * jedno wspólne konto podane z zewnątrz tego nie dawało.
 *
 * **Czego tu nie wolno asercjonować**: tego, że rejestracja NIE zostawia sesji. Lokalnie
 * zostawia (dwa ciasteczka `sb-`, bo `GOTRUE_MAILER_AUTOCONFIRM=true`), w produkcji nie
 * zostawia. Asercja na tym byłaby fałszywym dowodem — człon „recenzent ląduje wylogowany"
 * pilnuje wyłącznie `scripts/smoke-reviewer-path.sh`.
 *
 * Nagłówek `Origin` jest wymagany: `security.checkOrigin` odbija `POST /api/auth/*` bez niego
 * kodem 403, **zanim** kod trasy się wykona — bez tego nagłówka helper badałby CSRF, nie rejestrację.
 */
async function registerAccount(request: APIRequestContext, baseURL: string): Promise<Account> {
  const account: Account = {
    email: `reviewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "reviewer-path-e2e",
  };

  const response = await request.post("/api/auth/signup", {
    form: { email: account.email, password: account.password },
    headers: { Origin: baseURL },
    maxRedirects: 0,
  });

  expect(response.status(), "signup must redirect, not render an error").toBe(302);
  expect(response.headers().location).toBe("/auth/confirm-email");

  return account;
}

/**
 * Pola formularza są kontrolowane przez Reacta, a wyspa jest `client:load` — wpisanie wartości
 * **przed** hydratacją zostaje nadpisane pustym stanem komponentu. Powtarzamy wpis aż do skutku
 * **obserwowalnego** (pola trzymają wartości), nie przez `waitForTimeout`; to ten sam wzorzec
 * co `openFromIsland`, tylko dla wpisywania zamiast klikania.
 */
async function fillWhenHydrated(page: Page, values: { label: string; value: string }[]): Promise<void> {
  await expect(async () => {
    for (const { label, value } of values) {
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
    }
    for (const { label, value } of values) {
      await expect(page.getByRole("textbox", { name: label, exact: true })).toHaveValue(value, { timeout: 1000 });
    }
  }).toPass({ timeout: 15_000 });
}

function characterById(id: string) {
  const character = CHARACTER_POOL.find((candidate) => candidate.id === id);
  if (character === undefined) {
    throw new Error(`Character "${id}" is missing from CHARACTER_POOL`);
  }
  return character;
}

/**
 * Klik w wyzwalacz mieszkający w wyspie `client:load`.
 *
 * Wyspa jest renderowana po stronie serwera, więc przycisk **jest w DOM, zanim React podepnie
 * handler** — pierwsze kliknięcie potrafi przepaść bez śladu. Ponawiamy je aż do skutku
 * **obserwowalnego** (okno otwarte), a nie przez `waitForTimeout`: to nadal czekanie na stan.
 * Klikamy wyłącznie, gdy okno jeszcze nie stoi, żeby ponowienie nie trafiło w nakładkę.
 *
 * Konwencja obowiązuje każdy wyzwalacz wyspy w tym repozytorium — zwykły `click()` na pierwszej
 * interakcji po nawigacji jest tu źródłem flaków, nie oszczędnością.
 */
async function openFromIsland(trigger: Locator, opened: Locator): Promise<void> {
  await expect(async () => {
    if (!(await opened.isVisible())) {
      await trigger.click();
    }
    await expect(opened).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

/** Wiersz listy drużyn rozpoznajemy po nazwie-haszu — `exact`, bo nazwa jest podłańcuchem etykiet akcji. */
function teamLink(page: Page, callSign: string): Locator {
  return page.getByRole("link", { name: callSign, exact: true });
}

/** Usunięcie przez okno potwierdzenia (FR-010) — jedyna droga, jaką ma gracz. */
async function deleteTeam(page: Page, callSign: string): Promise<void> {
  const confirmation = page.getByRole("alertdialog");
  await openFromIsland(page.getByRole("button", { name: `Delete team ${callSign}` }), confirmation);
  await confirmation.getByRole("button", { name: "Delete team", exact: true }).click();

  await page.waitForURL(/\?deleted=1$/);
}

/**
 * Nazwa-hasz jest nadawana przez serwer i nieedytowalna (FR-011), więc unikalnego identyfikatora
 * nie da się **wstrzyknąć** — niesie go sama drużyna. Test zapamiętuje go, gdy tylko go pozna,
 * i sprząta wyłącznie tę drużynę; równoległe przebiegi na tym samym koncie nie kolidują.
 *
 * Zmienna jest modułowa, a testów w pliku jest dwa — mimo to nie ma tu współdzielenia:
 * `fullyParallel` rozprasza testy **między** workerów, a w obrębie workera biegną seryjnie,
 * więc każdy worker ma własną kopię modułu. Do tego drugi test w ogóle nie zapisuje drużyny.
 */
let createdCallSign: string | null = null;

test.afterEach(async ({ page }) => {
  // Siatka bezpieczeństwa: szczęśliwa ścieżka usuwa drużynę w teście, ale pad po zapisie,
  // a przed usunięciem, zostawiłby wiersz na koncie testowym.
  if (createdCallSign === null) {
    return;
  }
  const callSign = createdCallSign;
  createdCallSign = null;

  await page.goto("/");
  if ((await teamLink(page, callSign).count()) > 0) {
    await deleteTeam(page, callSign);
  }
});

/**
 * Człon ścieżki **przed** logowaniem, w części, która jest własnością aplikacji.
 *
 * **Co ten test dowodzi**: że po rejestracji recenzent widzi ekran potwierdzenia w kopii
 * **produkcyjnej** i ma z niego widoczną drogę dalej — do logowania. `confirm-email.astro:4`
 * rozgałęzia treść na `import.meta.env.DEV`, więc gałąź produkcyjna („Check your email" /
 * „Back to sign in") jest dostępna wyłącznie dlatego, że `webServer` stoi na `npm run preview`.
 * Każdy przebieg na `npm run dev` oglądałby drugą gałąź i regresja tutaj byłaby niewidoczna.
 *
 * **Czego ten test NIE dowodzi**: że recenzent jest po rejestracji wylogowany. Lokalnie jest
 * **zalogowany** (autopotwierdzanie stosu), w produkcji nie — to rozjazd konfiguracji, nie
 * zachowanie aplikacji. Pilnuje go `scripts/smoke-reviewer-path.sh`, nie ten plik.
 */
test("registration lands the reviewer on the production confirmation screen with a way on (risk #4)", async ({
  page,
}) => {
  const password = "reviewer-path-e2e";
  const email = `reviewer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/auth/signup");
  await fillWhenHydrated(page, [
    { label: "Email", value: email },
    { label: "Password", value: password },
    { label: "Confirm password", value: password },
  ]);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("/auth/confirm-email");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Droga dalej musi być **widoczna i działać** — sam ekran potwierdzenia bez wyjścia zostawia
  // recenzenta w ślepej uliczce, czyli dokładnie w ryzyku #4.
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.waitForURL("/auth/signin");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("saved team survives a page reload on the reviewer path (risk #4)", async ({ page, request, baseURL }) => {
  // ——— Setup: własne konto (osprzęt), potem logowanie — czyli wejście persony głównej ———
  const account = await registerAccount(request, baseURL ?? "");

  await page.goto("/auth/signin");
  // Rola, nie `getByLabel`: przełącznik widoczności hasła też niesie etykietę „…password",
  // więc zawężenie do pola tekstowego jest tym, co czyni lokator jednoznacznym.
  await fillWhenHydrated(page, [
    { label: "Email", value: account.email },
    { label: "Password", value: account.password },
  ]);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "Your teams" })).toBeVisible();

  // ——— Akcja: skompletowanie i zapisanie drużyny domykającej próg ———
  await page.getByRole("link", { name: /^Assemble/ }).click();
  await page.waitForURL("/teams/new");

  expect(SOLUTION, "character pool must admit a threshold-closing roster (PRD → Business Logic)").not.toBeNull();

  for (const member of SOLUTION ?? []) {
    const character = characterById(member.characterId);

    const picker = page.getByRole("dialog", { name: "Recruit a member" });
    await openFromIsland(page.getByRole("button", { name: "Recruit", exact: true }).first(), picker);

    await picker
      .getByRole("list", { name: "Available characters" })
      .getByRole("button", { name: character.name })
      .click();
    await picker.getByRole("button", { name: "Add to team" }).click();

    // Karta w składzie jest dowodem dodania — czekamy na nią, nie na upływ czasu.
    await expect(page.getByRole("button", { name: `Remove ${character.name}` })).toBeVisible();

    for (const perkId of member.perkIds) {
      const perk = character.perks.find((candidate) => candidate.id === perkId);
      if (perk === undefined) {
        throw new Error(`Perk "${perkId}" is missing from character "${character.id}"`);
      }
      const toggle = page.getByRole("button", { name: perk.name });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
    }
  }

  const embark = page.getByRole("button", { name: "Embark on the job" });
  await expect(embark).toBeEnabled();
  await embark.click();

  // Ekran potwierdzenia czyta nazwę **z bazy** (FR-019), więc jest pierwszym dowodem utrwalenia.
  await page.waitForURL(/\/teams\/[^/]+\/embark$/);
  const confirmation = page.getByRole("heading", { name: /is on the books$/ });
  await expect(confirmation).toBeVisible();

  const callSign = (await confirmation.innerText()).replace(/^Team\s+/, "").replace(/\s+is on the books$/, "");
  createdCallSign = callSign;

  // ——— Asercja ryzyka: drużyna jest na liście i przeżywa odświeżenie ———
  // Ta asercja pada dokładnie wtedy, gdy materializuje się ryzyko #4: recenzent po zalogowaniu
  // nie dociera do zapisanej drużyny. Tytuł strony ani sam redirect by tego nie złapały.
  await page.goto("/");
  await expect(teamLink(page, callSign)).toBeVisible();

  await page.reload();
  await expect(teamLink(page, callSign)).toBeVisible();

  // ——— Cleanup: usunięcie własnej drużyny (US-03) ———
  await deleteTeam(page, callSign);
  createdCallSign = null;

  await expect(page.getByText("Team deleted.")).toBeVisible();
  await expect(teamLink(page, callSign)).toHaveCount(0);
});
