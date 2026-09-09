# Ścieżka recenzenta e2e i bramki jakości — plan implementacji

## Przegląd

Faza 4 planu testów (`context/foundation/test-plan.md` §3) domyka ryzyko #4 — „recenzent nie
domyka ścieżki rejestracja → potwierdzenie adresu → logowanie i ocenia produkt, do którego nie
wszedł" — plus człon cross-cutting fazy (bramki, przegląd AI-natywny).

Rozstrzygnięcie nośne: **szew na potwierdzeniu**. Automat pokrywa tor, który aplikacja naprawdę
posiada — od rejestracji przez ekran potwierdzenia, logowanie, skompletowanie składu domykającego
próg, zapis, trwałość po odświeżeniu, aż do usunięcia — przeciwko **lokalnemu stosowi**. Człon
„rejestracja w produkcji zostawia recenzenta wylogowanym, a kliknięcie linku go nie loguje" **nie
dostaje automatu**, bo każdy dostępny automat na ten człon asercjonuje GoTrue, nie aplikację
(badanie §2, koszt 1). Zamiast tego dostaje **dym egzekwowalny**: skrypt, który sam wykonuje część
bezmailową przeciwko produkcji i odmawia zakończenia zerem, dopóki człowiek nie odda mu adresu,
na którym wylądował.

Faza zamyka też bramkę §5 `e2e na ścieżce persony głównej` — ale **osłabia** ją z `CI on PR` do
`local + przed oddaniem`, świadomie i z zapisanym powodem: spełnienie jej co do litery wymaga
postawienia Dockera w CI, co unieważnia jawne założenie, na którym stoi granica CI/ręczne Fazy 2
(`context/archive/2026-09-07-test-plan-refresh/plan-brief.md:79`). Faza 4 nie wydaje tej decyzji
po cichu „przy okazji".

## Analiza bieżącego stanu

Co istnieje:

- **Rusztowanie e2e, nie rozstrzygnięcie fazy.** Playwright `^1.63.0` w `devDependencies`,
  `playwright.config.ts` (28 linii) **świadomie bez `webServer`**, `e2e/` poza zakresem Vitest
  (`src/**/*.test.ts`), `test-results/` i `playwright-report/` w `.gitignore`.
- **`e2e/seed.spec.ts` (198 linii)** — seed test wedle `/10x-e2e`. Pokrywa tor **po** potwierdzeniu
  adresu: logowanie → skompletowanie składu z `findThresholdSolution` → zapis → drużyna widoczna po
  odświeżeniu → usunięcie przez okno potwierdzenia. Wymaga `E2E_EMAIL`/`E2E_PASSWORD` z zewnątrz
  (`requireEnv`, `:55-61`) i konta z potwierdzonym adresem. Niesie konwencję `openFromIsland`
  (`:82-89`) dla wyzwalaczy w wyspach `client:load`.
- **Precedens kontroli mutacyjnej §6.2**: `scripts/probe-save-barrier.sh` + wersjonowana
  `scripts/probe-save-barrier.patch` — odmowa startu na brudnym drzewie (`:52-56`), `trap` przed
  pierwszą modyfikacją (`:49-50`), odwrócony kod wyjścia (`:74-79`), świadomie **nie** w CI (`:19-20`).
- **Precedens dymu**: `context/deployment/deploy-plan.md` §3 i §5 (tabele z werdyktem na wiersz) oraz
  §6 (`:94-118`, ręczne przejście z logiem `wrangler tail`) — to właśnie ten dym **wykrył** rozjazd
  potwierdzania i doprowadził do zmiany decyzji PRD FR-001.
- **Hook po edycji z §5 jest już podpięty**: `.claude/settings.json` → `.claude/hooks/lint-typecheck.sh`
  (`eslint --fix` na edytowanym pliku + `tsc --noEmit --incremental` na projekcie), commit `5041b88`.
  Ta bramka jest do **zapisania jako spełniona**, nie do zbudowania.

Czego brakuje albo jest nieprawdą:

- **§6.6 przewodnika to `TBD`**, §3 wiersz 4 ma status `not started`, §4 wiersz `e2e` mówi
  „none yet — see Phase 4", §5 wiersz e2e mówi `CI on PR`.
- **`playwright.config.ts:6-8` obiecuje**, że „kiedy Faza 4 ruszy, to ona domyka `webServer`,
  projekt `setup` ze `storageState` i miejsce e2e w CI". Po tej fazie dwa z trzech członów tej
  obietnicy będą nieprawdą (miejsce w CI zostaje puste świadomie; `storageState` jest tu
  **niepożądany**, bo logowanie należy do chronionej ścieżki, nie do osprzętu).
- **`dist/server/.dev.vars` z builda 2026-09-07 leży w drzewie i wskazuje projekt hostowany.**
- **Pozycja „Konto testowe w produkcyjnej bazie — do usunięcia przed oddaniem projektu" stoi
  otwarta** (`deploy-plan.md:234-235`) i od tamtej pory urosła (zmiana
  `2026-09-06-cross-account-team-isolation` wykonała na produkcji macierz dwóch kont).

Ograniczenia odkryte i przesondowane (badanie + sondy tej sesji):

1. **Lokalny stos nie wykonuje toru potwierdzania** — `GOTRUE_MAILER_AUTOCONFIRM=true` jest wpieczone
   w env kontenera auth; `POST /api/auth/signup` oddaje 302 → `/auth/confirm-email` **i dwa ciasteczka
   `sb-`**. Lokalnie rejestracja **loguje**; w produkcji nie. Przełączenie flagi wymaga `supabase stop`
   + `start` i poprawki **trzech** pól `config.toml`, w tym dwóch, które zakaz `config push` nazywa
   najgroźniejszymi.
2. **Trzy rozjazdy lokalne/produkcja na tym torze, nie jeden.** `enable_confirmations`;
   `site_url` (`:3000` lokalnie — port, na którym nic nie stoi); oraz
   `src/pages/auth/confirm-email.astro:4` (`import.meta.env.DEV`), przez co ekran potwierdzenia ma
   **dwie różne treści**. `AGENTS.md` nazywa tylko pierwszy.
3. **`.dev.vars` nie stoi obok `.env` — wyłącza go.** `getVarsForDev`
   (`node_modules/wrangler/wrangler-dist/cli.js:297455`) czyta `.env` **wyłącznie** gdy `.dev.vars`
   nie istnieje; scalania nie ma. Nadpisania inline z powłoki do workera **nie dotrą**
   (`includeProcessEnv` fałszywe bez klucza `secrets` w `wrangler.jsonc`).
4. **`npm run preview` serwuje zmienne zamrożone w chwili builda.** Plugin Cloudflare emituje
   `dist/server/.dev.vars` jako asset builda (`node_modules/@cloudflare/vite-plugin/dist/index.mjs:53072`),
   a wrangler czyta ten plik „at preview time" (`:48466`). Zmiana `.env` **po** buildzie nie ma
   wpływu na preview. **Przesondowane 2026-09-09** (wcześniej ryzyko otwarte): `npm run preview`
   pod adapterem v13 wstaje w ~2 s, wypisuje dosłownie `Using secrets defined in dist/server/.dev.vars`,
   `GET /auth/signin` → 200, a `/auth/confirm-email` renderuje kopię **produkcyjną** („Check your
   email" / „Back to sign in"). Wybór preview nie jest już założeniem. Konsekwencja wiążąca dwie fazy: strażnik czytający tylko `.env` byłby zielony
   na rozbrojonym stanie, a łatka na `src/` nie działa na preview bez przebudowy.
5. **`webServer` startuje przed `globalSetup`** — `createGlobalSetupTasks` to najpierw
   `createPluginSetupTasks` (tam żyje `webServer`), potem pliki `globalSetup`
   (`node_modules/playwright/lib/runner/index.js:6321-6326`).
6. **`security.checkOrigin` jest aktywne** — `POST /api/auth/*` bez nagłówka `Origin` zwraca 403
   „Cross-site POST form submissions are forbidden", zanim kod trasy się wykona
   (`deploy-plan.md:209-212`).
7. **`npx tsc --noEmit` jest zielone na bazie** (sprawdzone w tej sesji, `e136707`) — `tsconfig.json`
   ma `include: ["**/*"]`, więc obejmuje `e2e/` i `playwright.config.ts`. `npx astro check` jest
   **czerwone** na `main` (2 × `ts(18047)`, znany dług §6.7) — nie jest kryterium tej fazy.
8. **Aplikacja nie ma szwu na wymianę kodu** — zero wywołań `exchangeCodeForSession`, `verifyOtp`,
   `getSessionFromUrl`; `src/pages/index.astro:29` czyta wyłącznie `deleted`. Człon „kliknięcie linku
   nie loguje" nie ma w kodzie miejsca, w które da się wbić asercję. To jest **strukturalny** powód,
   dla którego dym ręczny nie jest tu wygodą, tylko koniecznością.

## Pożądany stan końcowy

Po tej fazie:

- `npx playwright test` uruchomiony na czystym drzewie z `.env` wskazującym lokalny stos **sam
  stawia aplikację** (`npm run preview`), **sam zakłada konto** i przechodzi całą ścieżkę persony
  głównej. Bez żadnej zmiennej środowiskowej podanej z ręki.
- Ten sam `npx playwright test` z `.env` wskazującym projekt hostowany **odmawia przebiegu** z jednym
  czytelnym komunikatem — tak samo jak przy nieodświeżonym buildzie, przy obecnym root `.dev.vars`
  i przy leżącym stosie.
- `scripts/probe-reviewer-path.sh` kończy się zerem, wykazawszy trzema przebiegami, że test
  **czerwieni się** na zerwanej propagacji ciasteczka sesji i **zieleni** po zdjęciu łatki.
- `scripts/smoke-reviewer-path.sh` wykonuje trzy sondy bezmailowe przeciwko produkcji i **nie da się
  go zakończyć zerem** bez oddania adresu wylądowania i potwierdzenia usunięcia konta testowego.
- `test-plan.md` §6.6 jest wypełnione siedmioma polami wedle kształtu §6.2, §6.7 ma notę Fazy 4,
  §3 wiersz 4 ma `complete` i folder zmiany, §4 wiersz `e2e` nazywa realny stos, §5 ma trzy wiersze
  rozstrzygnięte (e2e osłabione z powodem, hook spełniony, multimodalny `optional`).
- Pozycja „Konto testowe w produkcyjnej bazie" w `deploy-plan.md` przestaje być otwartym zdaniem
  i staje się krokiem w skrypcie o nazwanej kadencji.

Weryfikacja stanu końcowego: kryteria automatyczne i ręczne poszczególnych faz plus sekcja
`## Progress` odhaczona w całości.

### Kluczowe odkrycia:

- `@cloudflare/vite-plugin/dist/index.mjs:53072` + `:48466` — build **wypieka** `dist/server/.dev.vars`,
  preview go czyta. To jedno ustalenie wiąże kształt strażnika (Faza 1) **i** kształt sondy mutacyjnej
  (Faza 3).
- `node_modules/playwright/lib/runner/index.js:6321-6326` — `webServer` przed `globalSetup`.
- `node_modules/wrangler/wrangler-dist/cli.js:297455` — `.dev.vars` **wyłącza** `.env`, nie uzupełnia.
- `src/lib/supabase.ts:17-21` — adapter `cookies.setAll`; jedyne miejsce, którego rozbrojenie daje
  awarię w kształcie ryzyka #4 (logowanie „udaje się", middleware nie widzi sesji) i którego **żadna
  warstwa poniżej e2e nie widzi**. Kanoniczna mutacja tej fazy.
- `e2e/seed.spec.ts:82-89` (`openFromIsland`) — konwencja obowiązująca każdy wyzwalacz wyspy; do
  ponownego użycia, nie do kopiowania na nowo.
- `scripts/probe-save-barrier.sh:44-79` — wzorzec sondy: `trap` przed pierwszą modyfikacją, odmowa na
  brudnym drzewie, odwrócony kod wyjścia. Przenosi się w rdzeniu; **nie** przenosi się w koszcie.
- `lessons.md` §„Linię bazową strażnika kotwicz na jawnym SHA" — **`base-sha` tej zmiany to
  `e136707`**. Każde kryterium porównujące ze stanem sprzed zmiany cytuje ten SHA, nigdy `HEAD`.

## Czego NIE robimy

- **Nie stawiamy stosu Supabase w CI.** Wariant technicznie tani (~2,0 GB obrazów przy `-x`, klucz
  anon deterministyczny i publiczny, repo publiczne), ale unieważnia jawne założenie granicy
  CI/ręczne Fazy 2. Bramka §5 zostaje osłabiona z zapisanym powodem.
- **Nie ruszamy `supabase/config.toml`** — żadnego z trzech pól (`enable_confirmations`, `site_url`,
  `additional_redirect_urls`). Twarda reguła `AGENTS.md` zostaje bez poprawki.
- **Nie budujemy automatu na backdoorze do `auth.users`.** Sekwencja `email_confirmed_at = null` →
  `resend` z PKCE → link z Mailpita przeszła w badaniu w całości, ale asercjonuje GoTrue, nie
  aplikację, i nie pokrywa wylądowania. Do nieodtwarzania bez zmiany tej decyzji.
- **Nie używamy Mailpita.** Przy tej granicy jest zbędny — żadnego listu nie czytamy.
- **Nie dodajemy zależności.** Żadnego `dotenv` (parsowanie dwóch linii wprost), żadnego parsera
  HTML, żadnego MCP. `zod` pozostaje niedodane.
- **Nie dodajemy `exchangeCodeForSession` ani trasy `/auth/callback`.** Skrócenie ścieżki persony
  o jeden krok jest zapisane jako pozycja produktowa (`deploy-plan.md:238-241`) — to zmiana
  produktu, nie testów.
- **Nie używamy `storageState` ani projektu `setup`** dla tej ścieżki. Logowanie jest tu **częścią
  chronionej ścieżki**, nie osprzętem (`seed.spec.ts:32-34`). `storageState` należy do testów,
  gdzie sesja jest tylko warunkiem wstępnym.
- **Nie podpinamy e2e ani przeglądu multimodalnego do `ci.yml`.** `ci.yml` zostaje pięciokrokowy.
- **Nie naprawiamy `npx astro check`** czerwonego na `main` — znany dług z §6.7, osobna zmiana.
- **Nie ruszamy `.env.local` w `.gitignore`** — otwarte pytanie #6 badania, jawnie osobna zmiana.
- **Nie ruszamy §1 ani §7 `test-plan.md`.** Strategia i przestrzeń negatywna zostają nietknięte;
  kryterium automatyczne to pilnuje wobec `e136707`.
- **Zamrożenie obejmuje §1–§5, nie §1 i §7 — i ta faza rozróżnia trzy przypadki, zamiast je zrównać.**
  Nagłówek `test-plan.md:3` mówi „Strategy is frozen at the top (**§1–§5**)", a §8 datuje przegląd
  całego bloku §1–§5. Ta faza dotyka trzech sekcji z tego bloku:
  - **§3 (Status) i §4 (wiersz `e2e`)** — wypełnienie zaślepek zaadresowanych **wprost do Fazy 4**
    („not started", „none yet — see Phase 4"); §3 sam mówi, że orkiestrator przesuwa Status.
    Zamrożenia to nie narusza — zaślepka czeka na wypełnienie, nie na rewizję.
  - **§5 (wiersz `e2e na ścieżce persony głównej`)** — to **jest** zmiana strategii: wiersz ma dziś
    wartość `CI on PR`, a faza nadpisuje ją słabszą. Traktujemy to jako **jawny, nazwany wyjątek od
    zamrożenia**, nie jako wypełnienie zaślepki. Pełny `/10x-test-plan --refresh` nie jest tu
    właściwym narzędziem: żaden z czterech wyzwalaczy z §8 nie opisuje „faza rozstrzygnęła bramkę",
    a refresh przepisałby sekcje, których ta faza nie bada. Ceną wyjątku jest wpis do §8 (patrz
    Faza 5, zmiana #4) — bez niego następny czytelnik nie odróżni decyzji od dryfu, czyli dokładnie
    ta klasa, którą `lessons.md` opisuje pięciokrotnie.
- **Nie dokładamy atrybutów testowych do `src/`.** Zero `data-testid` dziś, zero po tej fazie.

## Podejście do implementacji

Pięć faz, każda zamknięta własnym kryterium wykonawczym, w kolejności rosnącej zależności:
osprzęt musi stać, żeby test dał się uruchomić; test musi być zielony, żeby sonda mutacyjna miała
co rozbrajać; dym jest niezależny od trzech pierwszych; przewodnik i bramki zamykają fazę, gdy jest
już co opisać.

Trzy decyzje kształtujące, wszystkie wyprowadzone z ustaleń przesondowanych:

1. **Strażnik przed `webServer`em w kolejności ważności, nie wykonania.** Nie da się go postawić przed
   startem preview (Playwright startuje plugin pierwszy), ale da się sprawić, że **każda** droga
   uruchomienia — `webServer`, `reuseExistingServer`, ręcznie postawiona aplikacja, `E2E_BASE_URL` na
   cudzym adresie — trafia na tę samą odmowę przed pierwszym testem. Dlatego `globalSetup`, i dlatego
   sprawdza **oba** źródła zmiennych plus zdrowie stosu, a nie jedno.
2. **Rejestracja jest osprzętem i asercją jednocześnie, ale nie tą samą.** Jako osprzęt: `POST
   /api/auth/signup` z unikalnym adresem daje gotowe konto (lokalnie autopotwierdzone). Jako asercja:
   pod `npm run preview` ekran `/auth/confirm-email` renderuje **kopię produkcyjną**, więc „rejestracja
   prowadzi na »Check your email« i daje widoczną drogę dalej do logowania" jest własnością aplikacji
   i wolno ją związać. Czego **nie wolno** związać: tego, że recenzent ląduje wylogowany — lokalnie
   ląduje zalogowany. Ten człon należy do dymu i plan mówi to wprost w komentarzu testu.
3. **Sonda mutacyjna płaci za preview dwoma buildami.** Łatka na `src/lib/supabase.ts` nie działa na
   preview bez przebudowy. Sonda ma więc trzy przebiegi Playwrighta i dwa buildy, i **odróżnia
   czerwień od mutacji od czerwieni od osprzętu** — bez pierwszego i trzeciego przebiegu odwrócony
   kod wyjścia kłamie.

## Krytyczne szczegóły implementacji

- **Czas i cykl życia (jedno ustalenie, dwie fazy).** Build zamraża `SUPABASE_URL`/`SUPABASE_KEY`
  w `dist/server/.dev.vars`; preview czyta ten plik, nie `.env`. Skutki: (a) strażnik musi czytać ten
  plik, inaczej jest zielony na rozbrojonym stanie; (b) przepis uruchomienia to **`.env` → build →
  test**, w tej kolejności; (c) sonda mutacyjna musi przebudować po nałożeniu łatki i po jej zdjęciu.
  Pominięcie któregokolwiek z trzech daje zielony przebieg, który nie dowodzi niczego.
- **Sekwencjonowanie stanu.** `webServer` startuje **przed** `globalSetup`, więc strażnik zatrzymuje
  *testy*, nie *start aplikacji*. Jest to nieszkodliwe (postawienie preview nic nie zapisuje do żadnego
  projektu) i musi być zapisane w komentarzu strażnika, żeby przyszły czytelnik nie uznał kolejności
  za błąd.
- **Debugowanie i obserwowalność.** Sonda mutacyjna ma trzy różne kody wyjścia dla trzech różnych
  awarii („nie wiąże", „czerwone od osprzętu przed łatką", „nie wróciło do zieleni po zdjęciu"), bo
  odwrócony kod wyjścia bez tego rozróżnienia jest nieczytelny. Dodatkowa odmowa: zajęty port —
  reużyta cudza aplikacja serwowałaby **niezałataną** kompilację, a sonda zameldowałaby „nie wiąże".

---

## Faza 1: Osprzęt uruchomieniowy i strażnik stosu

### Przegląd

Postawić `webServer` na `npm run preview`, a przed nim strażnika, który odmawia przebiegu, gdy
cokolwiek w łańcuchu zmiennych może skierować e2e w projekt hostowany. Naprawić komentarz
w `playwright.config.ts`, który dziś obiecuje coś innego, niż ta faza dowozi.

### Wymagane zmiany:

#### 1. Strażnik stosu jako `globalSetup`

**Plik**: `e2e/stack-guard.ts` (nowy)

**Cel**: uczynić niemożliwym przebieg e2e przeciwko czemukolwiek innemu niż lokalny stos Supabase.
Obawa zapisana dziś w `playwright.config.ts:9-14` jest realna, ale `webServer` jej nie pogłębia —
pogłębia ją to, że przy `webServer` nikt już świadomie nie wybiera stosu. Strażnik jest tym, co ją
usuwa.

**Umowa**: domyślny eksport funkcji zgodnej z sygnaturą `globalSetup` Playwrighta
(`(config: FullConfig) => Promise<void>`), rzucającej `Error` z **jednym** komunikatem na przyczynę.
Cztery rozłączne odmowy, w tej kolejności (każda z nich odpowiada jednemu przesondowanemu ustaleniu):

1. **Root `.dev.vars` istnieje** → odmowa. Ten plik **wyłącza** `.env` (`cli.js:297455`), a `AGENTS.md:13`
   czyni `.env` jedynym sankcjonowanym przełącznikiem; obecność drugiego pliku znaczy, że nie wiadomo,
   co aplikacja wczytała. Komunikat ma wskazać `.env` jako właściwe miejsce.
2. **`.env` nie ustawia `SUPABASE_URL` na lokalny stos** (`http://127.0.0.1:54321`) → odmowa.
   To źródło, z którego build weźmie wartości.
3. **`dist/server/.dev.vars` nie istnieje albo nie wskazuje lokalnego stosu** → odmowa z komunikatem
   „build zamrożony na innym stosie — uruchom `npm run build`". To jest plik, który preview
   **faktycznie serwuje**; bez tej odmowy strażnik byłby zielony na rozbrojonym stanie.
4. **Lokalny stos nie odpowiada** — `GET http://127.0.0.1:54321/auth/v1/health` nie oddaje 200 →
   odmowa z komunikatem „uruchom `npx supabase start`". Bez tej odmowy przebieg pada w losowym
   miejscu z komunikatem o niczym.

Parsowanie plików: własna funkcja czytająca linie `KEY=VALUE` (obcięcie cudzysłowów, pominięcie
komentarzy) — **żadnej nowej zależności**; wartości sekretów nie są nigdzie wypisywane, tylko host.
Komentarz w pliku ma zapisać dwa fakty niewynikające z kodu: że `globalSetup` biegnie **po**
`webServer` (`runner/index.js:6321-6326`), i dlaczego sprawdzane są **dwa** pliki, nie jeden
(`@cloudflare/vite-plugin/dist/index.mjs:53072`, `:48466`).

#### 2. Konfiguracja Playwrighta

**Plik**: `playwright.config.ts`

**Cel**: uruchamiać aplikację z konfiguracji (koniec ręcznego przepisu na dwa terminale) i wpiąć
strażnika, a docstring przepisać na to, co ta faza rzeczywiście rozstrzyga.

**Umowa**: dodane `globalSetup: "./e2e/stack-guard.ts"` oraz
`webServer: { command: "npm run preview", url: <ten sam adres co baseURL>, reuseExistingServer: true, timeout: <hojny, build już jest gotowy> }`.
`baseURL` pozostaje `process.env.E2E_BASE_URL ?? "http://localhost:4321"` — nadpisanie adresu nadal
działa i nadal przechodzi przez strażnika. `reuseExistingServer: true`, żeby ręcznie postawione
preview było reużyte, a nie zderzało się o port; ta wygoda jest bezpieczna **wyłącznie** dzięki
odmowie #3, która pilnuje, co ten proces serwuje.

Docstring `:3-14` przepisany: `webServer` **jest** domknięty i **czym**. Powód wyboru preview nad dev
ma być zapisany **szerzej niż jeden ekran**: preview serwuje ten sam artefakt co wdrożenie — zbudowany
worker na `workerd`, zminifikowane wyspy, `import.meta.env.DEV` fałszywe — a test broni ścieżki
**produkcyjnej**, więc wierność wdrożonemu runtime'owi jest tu wymaganiem, nie wygodą. Rozjazd
`/auth/confirm-email` (`confirm-email.astro:4`) jest **dowodem tej klasy problemu, a nie całym
powodem**: to jedyny rozjazd dev/prod, który już udowodniono, ale wybór nie ma stać wyłącznie na nim
— inaczej pierwszy czytelnik, który obejdzie ten jeden ekran lokatorem odpornym na tryb, „zoptymalizuje"
konfigurację z powrotem do `dev` i będzie miał rację wobec zapisanego powodu; `storageState`
świadomie **nie** wchodzi (logowanie należy do chronionej ścieżki); miejsce w CI zostaje **puste
świadomie** — z odesłaniem do §5 `test-plan.md`, gdzie stoi powód.

#### 3. Przepis „przestawienie stosu", zapisany tam, gdzie się go szuka

**Plik**: `e2e/seed.spec.ts` (nagłówek `:36-43`)

**Cel**: zastąpić dzisiejszy przepis („uruchom aplikację, miej konto") przepisem prawdziwym po tej
fazie: `npx supabase start` → przestawienie `.env` na URL i klucz anon stosu → `npm run build` →
`npx playwright test`. Pełna wersja przepisu wchodzi do §6.6 w Fazie 5; tu stoi jego skrót.

**Umowa**: kolejność trzech kroków jest częścią przepisu, nie sugestią — build **po** przestawieniu
`.env`, bo inaczej odmowa #3. Nagłówek ma nazwać `.dev.vars` jako plik, którego **nie** wolno
tworzyć.

#### 4. Odświeżenie zamrożonego builda

**Plik**: `dist/server/.dev.vars` (artefakt, `dist/` jest w `.gitignore`)

**Cel**: dzisiejszy artefakt pochodzi z builda 2026-09-07 i wskazuje **projekt hostowany**. Nie jest
to edycja repozytorium, ale jest to krok, bez którego pierwszy przebieg fazy trafia w odmowę #3 —
i dobrze, że trafia. Krok wykonawczy: przebudowa po przestawieniu `.env`.

**Umowa**: po `npm run build` z lokalnym `.env` plik zawiera `SUPABASE_URL=http://127.0.0.1:54321`.
Nie commitujemy niczego z `dist/`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Strażnik **czerwieni się na stanie bazowym**: przy `.env` wskazującym projekt hostowany (stan
  drzewa na `e136707`) `npx playwright test` kończy się niezerowo i komunikatem odmowy #2, nie
  padem testu
- Odmowa #1 wiąże: przy istniejącym root `.dev.vars` (utworzonym na chwilę) `npx playwright test`
  odmawia komunikatem o przesłaniętym `.env`
- Odmowa #3 wiąże: przy `.env` lokalnym, ale **bez** przebudowy (artefakt z hostowanego builda)
  `npx playwright test` odmawia komunikatem „uruchom `npm run build`"
- Odmowa #4 wiąże: przy zatrzymanym stosie (`npx supabase stop`) `npx playwright test` odmawia
  komunikatem „uruchom `npx supabase start`"
- Po przestawieniu `.env` na lokalny stos i `npm run build`: `npx playwright test` **startuje
  aplikację z konfiguracji** i dochodzi do wykonania testu (wynik testu jest przedmiotem Fazy 2)
- `npx tsc --noEmit` zielone
- `npm run lint` zielone
- `git status --porcelain` czyste poza `.env` (gitignorowany) — żaden artefakt sond nie został w drzewie

#### Weryfikacja ręczna:

- Docstring `playwright.config.ts` czytany świeżym okiem nie obiecuje niczego, czego faza nie dowozi
  — w szczególności nie mówi o `storageState` ani o miejscu w CI jako o rzeczach do zrobienia
- Komunikaty czterech odmów są rozróżnialne i każdy mówi, **co zrobić**, nie tylko co jest źle

**Uwaga implementacyjna**: po zakończeniu tej fazy i wszystkich automatycznych weryfikacjach zatrzymaj
się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Test ścieżki recenzenta bez zewnętrznych zmiennych

### Przegląd

Zdjąć z testu wymóg konta podanego z zewnątrz i dołożyć jeden człon w górę ścieżki — ten, który
aplikacja naprawdę posiada i który pod preview jest produkcyjnie wierny.

### Wymagane zmiany:

#### 1. Fixture zakładający konto

**Plik**: `e2e/seed.spec.ts`

**Cel**: test ma być samowystarczalny. Lokalnie rejestracja autopotwierdza, więc konto gotowe do
logowania kosztuje jedno żądanie — a unikalny adres czyni równoległe przebiegi i ponowienia
bezkolizyjnymi, czego wspólne konto z `E2E_EMAIL` nie dawało.

**Umowa**: helper `registerAccount(request, baseURL)` wykonujący `POST /api/auth/signup` z ciałem
`form` (trasa czyta `formData()`, `signup.ts:5-7`) i **nagłówkiem `Origin` równym `baseURL`** — bez
niego Astro oddaje 403 przed wejściem w kod trasy (`deploy-plan.md:209-212`), czyli test badałby
CSRF, nie rejestrację. `maxRedirects: 0`, żeby zobaczyć 302; asercja `Location === "/auth/confirm-email"`.
Adres: `reviewer-<timestamp>-<losowy sufiks>@example.com`, hasło ≥ 6 znaków. Zwraca parę
`{ email, password }`.

`requireEnv` (`:55-61`) usunięte razem z `E2E_EMAIL`/`E2E_PASSWORD` — po tej zmianie nie ma
zmiennej, której brak trzeba zgłaszać.

**Komentarz obowiązkowy w pliku**: rejestracja jest tu **osprzętem, nigdy wyrocznią**. Lokalnie
zostawia sesję (dwa ciasteczka `sb-`), w produkcji nie zostawia; asercja na tym byłaby fałszywym
dowodem, a człon „recenzent ląduje wylogowany" należy do dymu (`scripts/smoke-reviewer-path.sh`,
Faza 4). Bez tego komentarza następny czytelnik dopisze tu dokładnie tę asercję.

#### 2. Człon „rejestracja daje widoczną drogę dalej"

**Plik**: `e2e/seed.spec.ts` — nowy test, drugi w pliku

**Cel**: związać jedyną część członu przed logowaniem, która jest własnością aplikacji i jest pod
preview produkcyjnie wierna: po rejestracji recenzent widzi ekran potwierdzenia z **produkcyjną**
treścią i ma z niego widoczną drogę do logowania. Dziś nic tego nie pilnuje, a
`confirm-email.astro:4` rozgałęzia treść na `import.meta.env.DEV`, więc regresja w gałęzi
produkcyjnej byłaby niewidoczna dla każdego przebiegu na `npm run dev`.

**Umowa**: przejście **przez interfejs** (`/auth/signup`, pola `Email`, `Password`,
`Confirm password`, przycisk `Create account`), `waitForURL("/auth/confirm-email")`, asercja na
nagłówek `Check your email` — czyli gałąź **produkcyjną**, dostępną wyłącznie dlatego, że
`webServer` stoi na preview — i przejście linkiem `Back to sign in` na `/auth/signin` z asercją, że
formularz logowania jest widoczny. Nazwa testu cytuje ryzyko #4.

**Komentarz obowiązkowy**: co ten test dowodzi (kopia produkcyjna + istnienie drogi dalej) i czego
**nie** dowodzi (że recenzent jest wylogowany — lokalnie jest zalogowany). Granica ma stać w pliku,
nie tylko w planie.

#### 3. Test ryzyka na własnym koncie

**Plik**: `e2e/seed.spec.ts` — istniejący test `:127-198`

**Cel**: ten sam przebieg, ale konto pochodzi z fixture'u, nie ze środowiska.

**Umowa**: `page.goto("/auth/signin")` poprzedzone wywołaniem `registerAccount`; `fill` bierze wartości
ze zwróconej pary. Wszystko poniżej — `openFromIsland`, `SOLUTION` z `findThresholdSolution`,
asercja trwałości po `reload()`, cleanup przez okno potwierdzenia, siatka `afterEach` — **bez zmian**.
Moduł-poziomowy `createdCallSign` (`:110`) zostaje: `fullyParallel` rozprasza testy między workerami,
a w obrębie workera biegną seryjnie, więc zmienna jest per-worker i nie ma współdzielenia; ten powód
warto dopisać obok, bo przy dwóch testach w pliku pytanie się nasunie.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npx playwright test` zielone **dwa przebiegi pod rząd** w środowisku bez `E2E_EMAIL`
  i `E2E_PASSWORD` (`env -u E2E_EMAIL -u E2E_PASSWORD npx playwright test`)
- Strażnik zniknięcia zmiennych **czerwieni się na bazie** (`e136707`) i jest zielony po zmianie:
  `git show e136707:e2e/seed.spec.ts | grep -nE 'E2E_(EMAIL|PASSWORD)|requireEnv'` zwraca trafienia,
  a `grep -nE 'E2E_(EMAIL|PASSWORD)|requireEnv' e2e/seed.spec.ts` nie zwraca nic
- Nowy test istnieje i wiąże gałąź produkcyjną: `grep -n 'Check your email' e2e/seed.spec.ts`
  zwraca trafienie, a `git show e136707:e2e/seed.spec.ts | grep -c 'Check your email'` daje `0`
- `npx tsc --noEmit` i `npm run lint` zielone
- Niezmiennik utrzymaniowy antywzorców — `! grep -rnE 'waitForTimeout|getByTestId|page\.(locator|\$\$?)\(' e2e/`.
  **Zielony na bazie świadomie**: nie jest dowodem tej fazy, tylko strażnikiem tego, co faza dopisuje.
  Zapisane jawnie, żeby nie liczyć go jako drugiej bariery

#### Weryfikacja ręczna:

- Przebieg z `--headed` na nowym teście: ekran po rejestracji pokazuje **„Check your email"**, nie
  „Registration successful" — czyli preview naprawdę serwuje gałąź produkcyjną
- Komentarze o granicy (rejestracja jako osprzęt; czego nowy test nie dowodzi) są czytelne dla kogoś,
  kto nie brał udziału w planowaniu

**Uwaga implementacyjna**: zatrzymaj się tu na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Kontrola mutacyjna e2e

### Przegląd

Wykazać, że test z Fazy 2 czerwieni się na awarii w kształcie ryzyka #4 — i że jego zieleń nie jest
własnością osprzętu. Wzorzec §6.2 przenosi się w rdzeniu; koszt rośnie, bo preview serwuje build.

### Wymagane zmiany:

#### 1. Wersjonowana łatka rozbrajająca

**Plik**: `scripts/probe-reviewer-path.patch` (nowy)

**Cel**: rozbroić dokładnie tę jedną rzecz, której **żadna warstwa poniżej e2e nie widzi** —
propagację ciasteczka sesji. Po nałożeniu logowanie „udaje się" (`POST /api/auth/signin` → 302 `/`),
ale middleware nie widzi użytkownika i odbija na `/auth/signin`; recenzent nie wchodzi. Ani jeden test
trasy nie prowadzi prawdziwego słoika ciasteczek przez dwa żądania, więc ta awaria jest ślepym
punktem wszystkiego poniżej.

Łatka, nie `sed` — trzy powody utrwalone przy §6.2 (`git apply -R` cofa dokładnie; przy refaktorze
przestaje się nakładać **głośno**; jest recenzowalna w diffie).

**Umowa**: pojedynczy hunk w `src/lib/supabase.ts`, zamieniający ciało `setAll` (`:17-21`).
Hunk zamrożony w planie — implementacja generuje plik przez `git diff` po ręcznej edycji i wraca
do stanu czystego, a treść ma być dokładnie ta:

```diff
       setAll(cookiesToSet) {
-        cookiesToSet.forEach(({ name, value, options }) => {
-          cookies.set(name, value, options);
-        });
+        // PROBE (scripts/probe-reviewer-path.patch): propagacja ciasteczka sesji zerwana —
+        // logowanie „udaje się" (302 → `/`), ale middleware nie widzi sesji i odbija na /auth/signin.
+        void cookiesToSet;
       },
```

#### 2. Skrypt sondy

**Plik**: `scripts/probe-reviewer-path.sh` (nowy)

**Cel**: uruchomienie sondy ma być tańsze niż jej założenie — i ma odróżniać „czerwone od mutacji"
od „czerwone od osprzętu", bo sonda e2e ma tę klasę awarii, której sonda §6.2 nie ma (stojący stos,
`.env`, build, konto, przeglądarka — każdy warunek to osobna droga do fałszywej czerwieni).

**Umowa**: `set -euo pipefail`, `cd` do korzenia repozytorium, `trap cleanup EXIT` + `trap on_signal
INT TERM` ustawione **przed** pierwszą modyfikacją, `git apply -R` w `cleanup`. Odmowy startu:
brudne `src/lib/supabase.ts` (exit 2), łatka nie nakłada się czysto (exit 3), **port aplikacji zajęty**
(exit 6 — reużyta cudza aplikacja serwowałaby niezałataną kompilację i sonda zameldowałaby „nie
wiąże"). Potem trzy przebiegi:

| # | krok | wymagany wynik | kod wyjścia przy złamaniu |
|---|---|---|---|
| 1 | `npm run build` + `npx playwright test` na czystym drzewie | **zielony** | 4 — „czerwone od osprzętu, nie od mutacji" |
| 2 | `git apply` łatki, `npm run build`, `npx playwright test` | **czerwony** | 1 — „SONDA NIE WIĄŻE" |
| 3 | `git apply -R`, `npm run build`, `npx playwright test` | **zielony** | 5 — „łatka nie zdjęła się czysto" |

Zero na wyjściu znaczy: wykazano wszystkie trzy. Nagłówek pliku musi mówić wprost, że **kod wyjścia
jest odwrócony wobec `npm test`** dla przebiegu 2, i **dlaczego są trzy przebiegi i dwa buildy** —
preview serwuje `dist/server/.dev.vars` i skompilowany worker, więc łatka na `src/` bez przebudowy
nie ma żadnego skutku, a sonda bez przebudowy jest zielona i kłamie.

Świadomie **nie** w CI — ten sam powód co przy §6.2: łatanie plików źródłowych na runnerze to nowa
klasa awarii zielonego builda.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `git apply --check scripts/probe-reviewer-path.patch` przechodzi na czystym drzewie
- `scripts/probe-reviewer-path.sh` kończy się **zerem** (czyli wykazał zielony → czerwony → zielony)
- Odmowa na brudnym drzewie wiąże: po ręcznej modyfikacji `src/lib/supabase.ts` skrypt kończy się
  kodem 2 i **nie** dotyka drzewa
- Odmowa na zajętym porcie wiąże: przy ręcznie postawionym `npm run preview` skrypt kończy się kodem 6
- `git status --porcelain src/lib/supabase.ts` czyste po przebiegu **oraz** po przerwaniu skryptu
  sygnałem w trakcie przebiegu 2
- `npm run lint` zielone (skrypt jest `.sh`, ale łatka i tak nie może zostać w drzewie)

#### Weryfikacja ręczna:

- Wyjście przebiegu 2 wymienia **nazwy** padłych testów, nie samą liczbę — inaczej czytelnik nie wie,
  czy padło z powodu mutacji
- Trzy różne kody wyjścia dają trzy różne, czytelne komunikaty; żaden nie brzmi jak drugi

**Uwaga implementacyjna**: zatrzymaj się tu na ręczne potwierdzenie przed Fazą 4.

---

## Faza 4: Dym produkcyjny egzekwowalny

### Przegląd

Człon „rejestracja w produkcji nie loguje, a kliknięcie linku też nie" nie ma automatu i nie będzie
go miał. Dostaje więc dym, który jest **stanem obserwowalnym**, a nie zdaniem w planie — i który
domyka otwartą pozycję konta testowego, zamiast ją powiększać.

### Wymagane zmiany:

#### 1. Skrypt dymu

**Plik**: `scripts/smoke-reviewer-path.sh` (nowy)

**Cel**: wykonać samodzielnie wszystko, co da się wykonać bez skrzynki pocztowej, a resztę
**wymusić** na człowieku, odmawiając zakończenia zerem bez dowodu.

**Umowa**: `PROD_URL` z domyślną wartością `https://team-maker.jakub-e9b.workers.dev`
(`deploy-plan.md:81`), nadpisywalną argumentem albo zmienną. Trzy sondy bezmailowe, każda z werdyktem
na wiersz, o kształcie przesondowanym **dziś** (nie z tabeli `deploy-plan.md` §5, która pochodzi
sprzed objęcia `/` ochroną):

| sonda | oczekiwane |
|---|---|
| `GET /` | 302 → `/auth/signin` |
| `GET /auth/signin` | 200 |
| `POST /api/auth/signin` z fałszywymi danymi i nagłówkiem `Origin: $PROD_URL` | 302 → `?error=Invalid%20login%20credentials` |

Nagłówek `Origin` jest wymagany, inaczej sonda mierzy CSRF, nie logowanie.

Potem **brama ręczna**: skrypt wypisuje kroki, których nie umie zrobić (zarejestruj konto na adresie,
który kontrolujesz; otwórz list; kliknij link; zanotuj adres, na którym wylądowałeś; przejdź logowanie
i potwierdź, że widzisz listę drużyn), i czyta ze standardowego wejścia **adres wylądowania**.
Warunki przyjęcia: absolutny URL na hoście `PROD_URL` zawierający parametr `code=` — czyli kształt
zapisany z produkcji (`deploy-plan.md:106`). Cokolwiek innego, puste wejście albo **brak terminala**
→ zakończenie niezerowe. Druga brama: potwierdzenie usunięcia konta testowego (`yes`), z komunikatem
nazywającym pozycję długu, gdy człowiek odmówi.

Nagłówek pliku ma zapisać kadencję — **„przed oddaniem projektu recenzentowi", nie „przy każdym
scaleniu"** — i jej powód: persona główna wchodzi **raz**, a każdy przebieg zakłada trwałe konto
w produkcyjnej bazie i wysyła realny list (limit `email_sent = 2` obowiązuje w produkcji, lokalnie
jest nadpisany na 360000).

#### 2. Domknięcie pozycji konta testowego

**Plik**: `context/deployment/deploy-plan.md` (sekcja `## Otwarte po tym wdrożeniu`, `:234-235`)

**Cel**: pozycja „Konto testowe w produkcyjnej bazie" stoi otwarta od 2026-08-30 i od tamtej pory
urosła — dwa kolejne plany przyjęły ten dług bez kryterium sprzątania. Trzecie przyjęcie byłoby
wzorcem, nie wyjątkiem.

**Umowa**: pozycja przepisana na odesłanie do `scripts/smoke-reviewer-path.sh` z nazwaną kadencją
i informacją, że usunięcie konta jest **krokiem skryptu**, a nie osobnym zadaniem do zapamiętania.
Reszta sekcji nietknięta; historyczne §1–§6 `deploy-plan.md` nietknięte.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Trzy sondy bezmailowe przechodzą przeciwko produkcji: `scripts/smoke-reviewer-path.sh` wypisuje
  3/3 przed dojściem do bramy ręcznej
- **Odmowa zera wiąże**: uruchomienie bez terminala (`scripts/smoke-reviewer-path.sh < /dev/null`)
  kończy się **niezerowo**, nie zerem — brak dowodu nie może wyglądać jak dym wykonany
- Odmowa na złym dowodzie wiąże: podany adres bez `code=` albo na innym hoście → niezerowo
- `deploy-plan.md` nadal zawiera swoje sekcje historyczne: `grep -c '^### ' context/deployment/deploy-plan.md`
  daje tę samą wartość co `git show e136707:context/deployment/deploy-plan.md | grep -c '^### '`

#### Weryfikacja ręczna:

- **Pełny przebieg dymu przeciwko produkcji wykonany**: rejestracja, list, kliknięcie linku,
  wylądowanie, logowanie, widok listy drużyn — z werdyktem oddanym skryptowi
- **Konto testowe usunięte**, w tym konta pozostawione przez poprzednie zmiany
  (`cross-account-team-isolation`), żeby recenzent nie oglądał danych testowych
- Kroki ręczne wypisane przez skrypt dają się wykonać bez zaglądania do planu

**Uwaga implementacyjna**: zatrzymaj się tu na ręczne potwierdzenie przed Fazą 5. Ta faza ma
**najwięcej** treści ręcznej i jej potwierdzenie jest potwierdzeniem samego pokrycia ryzyka #4.

---

## Faza 5: Przewodnik, bramki i przegląd zimnego czytelnika

### Przegląd

Zapisać, czego faza się nauczyła, i rozstrzygnąć trzy wiersze §5 — w tym jeden przez świadome
osłabienie. Plus jednorazowy przegląd „zimnego czytelnika", jedyne kryterium PRD, którego żaden test
deterministyczny nie postawi.

### Wymagane zmiany:

#### 1. §6.6 — przepis dodawania testu e2e

**Plik**: `context/foundation/test-plan.md` §6.6 (`:218-221`, dziś `TBD`)

**Cel**: zastąpić `TBD` przepisem o kształcie §6.2, żeby następny test e2e nie wymyślał osprzętu
od nowa.

**Umowa**: siedem pól, wedle §6.2. **Lokalizacja**: `e2e/`, poza zakresem Vitest — bez wyjątku
w rodzaju §6.2, bo `e2e/` nie leży w `src/pages/`. **Nazewnictwo**: `<obszar>.spec.ts`;
`seed.spec.ts` zachowuje nazwę, bo pełni podwójną rolę (wzorzec dla `/10x-e2e` **i** pokrycie ryzyka
#4). **Czystość**: kryterium jest inne niż w Vitest — nic w `e2e/` nie może importować modułu
rozwiązującego `astro:*` (czyli `@/lib/supabase` jest zakazany, `@/lib/domain/*` dozwolony); alias
`@/*` rozwiązuje się przez `paths` z `tsconfig.json`. **Wyrocznia**: trwałość drużyny po odświeżeniu
i widok na liście — **nigdy** sumy punktowe; `findThresholdSolution` jest nawigacją po łamigłówce
(setup), nie wyrocznią. **Test referencyjny**: `e2e/seed.spec.ts`. **Uruchomienie**: `npx supabase
start` → `.env` na URL i klucz anon stosu (nigdy `.dev.vars` — wyłącza `.env`) → `npm run build`
(zamraża te wartości w `dist/server/.dev.vars`, które preview czyta) → `npx playwright test`;
strażnik `e2e/stack-guard.ts` odmawia przy każdym złamaniu tej kolejności. **Kontrola mutacyjna**:
`scripts/probe-reviewer-path.sh` — kanoniczna mutacja to zerwanie propagacji ciasteczka sesji, trzy
przebiegi i dwa buildy, kod wyjścia odwrócony na drugim.

Do przepisu wchodzi też **granica**: co automat pokrywa (od rejestracji w dół, na lokalnym stosie),
czego nie pokryje nigdy (wylądowanie recenzenta z linku, konfiguracja `site_url` projektu hostowanego,
produkcyjna kopia ekranów, dostarczalność listu — ta ostatnia świadomie wyłączona w §7) i gdzie żyje
reszta (`scripts/smoke-reviewer-path.sh`).

#### 2. §6.7 — nota z fazy

**Plik**: `context/foundation/test-plan.md` §6.7

**Cel**: 2–3 punkty o tym, czego faza **okazała się** uczyć — nie streszczenie planu.

**Umowa**: wpis „Faza 4 (data)" z co najmniej trzema ustaleniami, w tym: (a) build zamraża stos, więc
strażnik czytający `.env` byłby zielony na rozbrojonym stanie, a sonda mutacyjna kosztuje dwa buildy;
(b) rozjazdów lokalne/produkcja na tym torze jest **trzy**, nie jeden, i dwa z nich nie były nigdzie
zapisane; (c) automat na potwierdzaniu **istnieje** i przeszedł w badaniu, a został odrzucony na
koszcie × sygnale, nie na niewykonalności — do nieodtwarzania bez zmiany decyzji. Plus ustalenia
przeglądu zimnego czytelnika (punkt 5 niżej).

#### 3. §3 i §4 — status i stos

**Plik**: `context/foundation/test-plan.md` §3 (wiersz 4) i §4 (wiersz `e2e`)

**Cel**: tabele mają mówić prawdę o stanie.

**Umowa**: §3 wiersz 4 → `Status: complete`, `Change folder: context/changes/testing-reviewer-path-e2e/`.
§4 wiersz `e2e` → `Playwright` / `^1.63.0` / notka wskazująca `webServer` na `npm run preview`,
strażnika stosu i wzorzec §6.6. Uzasadnienie kolejności w §3 (`:87-94`) dostaje **jedno zdanie
prawdy**: Faza 4 została otwarta poza kolejnością (przed Fazami 2 i 3) z powodu kontekstu kursowego,
a nie rewizji uzasadnienia — i uzasadnienie zostaje w mocy.

#### 4. §5 — trzy wiersze bramek

**Plik**: `context/foundation/test-plan.md` §5

**Cel**: rozstrzygnąć bramki fazy, w tym jedną przez świadome osłabienie.

**Umowa**: (a) wiersz `e2e na ścieżce persony głównej` — kolumna `Where` z `CI on PR` na
`local (`npx supabase start` + `npm run build`) + przed oddaniem`, `Required?` na
`required after §3 Phase 4 (local)`, plus **zdanie powodu**: spełnienie w CI wymaga `services:`/Dockera,
co unieważnia jawne założenie granicy CI/ręczne ryzyka #2, więc rozstrzygnięcie należy do Fazy 2 albo
do wspólnej decyzji obu faz — osłabienie jest świadome, nie przeoczone. (b) wiersz `hook po edycji`
→ oznaczony jako **już podpięty** (`.claude/settings.json`, commit `5041b88`), z zachowanym
„nie zastępuje CI". (c) wiersz `przegląd multimodalny` zostaje `optional`, ale `Where` przestaje
mówić `CI on PR` — przegląd jest jednorazowy, nie bramka. (d) wiersz `dym ręczny przeciwko produkcji`
→ odesłanie do `scripts/smoke-reviewer-path.sh` i kadencja „przed oddaniem".

**Wyjątek od zamrożenia — do nazwania, nie do przemilczenia.** Punkt (a) jest zmianą strategii
w sekcji, którą nagłówek `test-plan.md:3` zamraża (§1–§5), więc nie wolno go zostawić nieodróżnialnym
od wypełnienia zaślepki (patrz „Czego NIE robimy"). Zdanie powodu przy wierszu ma zaczynać się od
**„Osłabione świadomie w Fazie 4 (…)"** z odesłaniem do tego folderu zmiany — żeby powód stał przy
wierszu, a nie tylko w planie, którego nikt nie otworzy.

#### 4a. §8 — wpis do Freshness Ledger

**Plik**: `context/foundation/test-plan.md` §8

**Cel**: wyjątek od zamrożenia ma zostawić ślad w miejscu, które datuje przegląd strategii — inaczej
`Strategy (§1–§5) last reviewed: 2026-09-07` kłamie po tej fazie.

**Umowa**: `Strategy (§1–§5) last reviewed` → data tej fazy, a linia `Ostatni refresh` **zostaje
nietknięta** (to nie był refresh — §8 mówi wprost, że wpis jest jednorazowy i nadpisywany przez
kolejny refresh). Zamiast tego dopisana **jedna** linia nazywająca wyjątek: która sekcja, który
wiersz, z czyjej decyzji i gdzie stoi uzasadnienie. Listy wyzwalaczy refreshu **nie ruszamy** — żaden
z nich nie opisuje tego przypadku i to jest właśnie powód, dla którego idziemy wyjątkiem, a nie
refreshem.

#### 5. Przegląd „zimnego czytelnika"

**Plik**: ustalenia → `context/foundation/test-plan.md` §6.7 (bez nowego artefaktu)

**Cel**: orzec, czy reguła domenowa jest odkrywalna **bez tutoriala** — jedyne kryterium sukcesu PRD
(`## Success Criteria`, Primary), którego żaden test deterministyczny nie postawi.

**Umowa**: 1–3 ekrany, wybrane jako krytyczne dla obcego: pusty stan listy drużyn (PRD wymaga
wyjaśnienia i wezwania, nie zera wyników), ekran kompletowania z wykresem i zablokowanym przyciskiem,
ekran po zapisie. Werdykt binarny na ekran plus co najwyżej po jednym zdaniu uzasadnienia, do §6.7.
**Nie używać** do wartości liczbowych, werdyktu progu ani stanu przycisku (§3 `:99-101`) — te są
deterministyczne, tańsze i już pokryte.

#### 6. Jedna linia w regułach twardych

**Plik**: `AGENTS.md`

**Cel**: reguła, której złamanie strażnik z Fazy 1 wyłapuje, powinna być zapisana tam, gdzie agent
ją czyta — inaczej każdy kolejny czytelnik odkrywa mechanikę `.dev.vars`/builda od nowa. `AGENTS.md`
nazywa dziś tylko pierwszy z trzech rozjazdów.

**Umowa**: jedno zdanie dopisane do reguły o lokalnym dev (`:13`): e2e biegnie wyłącznie przeciwko
lokalnemu stosowi, przełącznikiem jest zawartość `.env` (`.dev.vars` **wyłącza** `.env`, nie uzupełnia
go), a `npm run preview` serwuje wartości **zamrożone w chwili builda** w `dist/server/.dev.vars` —
więc kolejność to `.env` → `build` → `test`. Bez zmiany żadnej istniejącej reguły.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- §6.6 nie zawiera już `TBD`: `! grep -n 'TBD' <(sed -n '/^### 6.6/,/^### 6.7/p' context/foundation/test-plan.md)`
- §6.6 ma wszystkie siedem pól: każde z `Lokalizacja`, `Nazewnictwo`, `Czystość`, `Wyrocznia`,
  `Test referencyjny`, `Uruchomienie`, `Kontrola mutacyjna` występuje w wycinku §6.6
- §3 wiersz 4 nie ma już `not started`, a `git show e136707:context/foundation/test-plan.md`
  pokazuje, że **miał** — strażnik czerwony na jawnym `base-sha`, nie na `HEAD`
- §5 nie wiąże e2e z CI: `! grep -nE '^\| e2e na ścieżce persony głównej \|.*CI on PR' context/foundation/test-plan.md`,
  przy potwierdzonym trafieniu tego wzorca w `git show e136707:context/foundation/test-plan.md`
- **§8 datuje wyjątek**: `Strategy (§1–§5) last reviewed` ma datę tej fazy, nie `2026-09-07`,
  a §8 zawiera linię nazywającą osłabiony wiersz §5 i odsyłającą do tego folderu zmiany; linia
  `Ostatni refresh` jest **identyczna** jak w `git show e136707:context/foundation/test-plan.md`
- **§1 i §7 nietknięte** wobec jawnego `base-sha`: `diff <(git show e136707:context/foundation/test-plan.md | sed -n '/^## 1\. Strategy/,/^## 2\./p') <(sed -n '/^## 1\. Strategy/,/^## 2\./p' context/foundation/test-plan.md)`
  pusty; to samo dla §7 (`/^## 7\./,/^## 8\./`)
- `ci.yml` nietknięty: `diff <(git show e136707:.github/workflows/ci.yml) .github/workflows/ci.yml` pusty
- `AGENTS.md` zmienił się o dopisek, a nie o przepisanie reguły:
  `git diff e136707 -- AGENTS.md` nie zawiera ani jednej linii `-` poza tą, do której dopisano zdanie
- `npm run lint` i `npx tsc --noEmit` zielone; `npx prettier --check` na dotkniętych plikach `.md`
  (uwaga: `prettier --check` pada na `context/foundation/*.md` **już na bazie** — kryterium dotyczy
  wyłącznie plików dotkniętych tą fazą i porównania z ich stanem bazowym)
- `npm test` zielone — faza nie miała ruszyć warstwy Vitest i nie ruszyła

#### Weryfikacja ręczna:

- **Przegląd zimnego czytelnika wykonany** na 1–3 ekranach, werdykty i uzasadnienia w §6.7
- §6.6 czytane przez kogoś, kto ma napisać drugi test e2e, wystarcza — bez zaglądania do tego planu
- §5 wiersz e2e czyta się jako **decyzja z powodem**, nie jak niedokończona robota
- Nota §6.7 mówi, czego faza się nauczyła, a nie co zrobiła

**Uwaga implementacyjna**: to ostatnia faza; po jej ręcznym potwierdzeniu zmiana jest gotowa do
`/10x-impl-review` i `/10x-archive`.

---

## Strategia testowania

Ta zmiana **jest** warstwą testową, więc „strategia testowania" znaczy tu: czym dowodzimy, że nowa
warstwa nie jest dekoracją.

### Testy jednostkowe:

- Żadnych nowych. `npm test` (Vitest, `src/**/*.test.ts`) ma pozostać nietknięte i zielone —
  jest to kryterium Fazy 5, nie efekt uboczny.

### Testy integracyjne:

- Żadnych nowych. Tor żądania dla ryzyk #2 i #3 należy do Fazy 2 planu testów; ta zmiana świadomie
  go nie dotyka.

### E2E:

- `e2e/seed.spec.ts` — dwa testy. Pierwszy: rejestracja → produkcyjna kopia ekranu potwierdzenia →
  widoczna droga do logowania. Drugi: rejestracja (osprzęt) → logowanie → skład domykający próg →
  zapis → trwałość po odświeżeniu → usunięcie. Wyrocznią jest trwałość drużyny, nie sumy punktowe.
- Kontrola mutacyjna: `scripts/probe-reviewer-path.sh` — trzy przebiegi, kanoniczna mutacja
  w `src/lib/supabase.ts:17-21`.

### Kroki testowania ręcznego:

1. `npx supabase start`; `.env` przestawione na `http://127.0.0.1:54321` i klucz anon ze
   `npx supabase status`; `npm run build`; `npx playwright test --headed` — potwierdzić wzrokowo, że
   ekran po rejestracji mówi **„Check your email"** (gałąź produkcyjna), a nie „Registration successful".
2. Cztery odmowy strażnika, każda wywołana osobno: root `.dev.vars`, `.env` na hostowanym,
   nieodświeżony build, `npx supabase stop`.
3. `scripts/probe-reviewer-path.sh` — przeczytać wyjście przebiegu 2 i potwierdzić, że padły testy
   ścieżki recenzenta, a nie osprzęt. Przerwać skrypt sygnałem w trakcie i potwierdzić czystość drzewa.
4. `scripts/smoke-reviewer-path.sh` przeciwko produkcji: pełne przejście z rejestracją, listem,
   kliknięciem linku, wylądowaniem, logowaniem i widokiem listy drużyn. Potem usunięcie konta —
   swojego i tych z poprzednich zmian.
5. Przegląd zimnego czytelnika na trzech ekranach; werdykt na ekran.

## Uwagi dotyczące wydajności

Nie ma budżetu wydajnościowego dla tej warstwy, ale są dwa realne koszty czasu, obie do świadomego
przyjęcia:

- **Sonda mutacyjna to dwa buildy plus trzy przebiegi przeglądarki.** To wielokrotność kosztu sondy
  §6.2 (sekundy, `npm test`, zero stanu zewnętrznego). Sonda jest kryterium **ręcznym** i nie idzie
  do CI, więc koszt płaci się raz na zmianę dotykającą tej ścieżki, nie na każdy commit.
- **`webServer` na preview wymaga wcześniejszego builda**, którego Playwright **nie** uruchamia. Jest
  to świadome: gdyby `webServer.command` budował, każdy przebieg płaciłby build, a strażnik straciłby
  najostrzejszą odmowę („build zamrożony na innym stosie"), bo build byłby zawsze świeży — kosztem
  cichego przemilczenia, którego stosu dotyczył.

## Uwagi dotyczące migracji

Brak migracji bazy danych. Dwa stany zastane wymagają jednak przełączenia u każdego, kto tę zmianę
odbierze:

- **`.env` w drzewie roboczym wskazuje projekt hostowany.** Plik jest gitignorowany, więc zmiana go
  nie przenosi — przełączenie jest krokiem ręcznym z przepisu §6.6, a strażnik jest tym, co czyni
  jego pominięcie głośnym. Po e2e warto przestawić `.env` z powrotem, jeśli potrzebny jest dev
  przeciwko projektowi hostowanemu; drugie zabezpieczenie nie istnieje i nie jest potrzebne, bo
  aplikacja na lokalnym stosie działa bez zmian w kodzie.
- **`dist/server/.dev.vars` z 2026-09-07 wskazuje projekt hostowany.** Pierwsze `npx playwright test`
  po tej zmianie **ma** odmówić z tego powodu — to nie awaria, to strażnik.

## Referencje

- **`base-sha` tej zmiany: `e136707`** — każde kryterium porównujące ze stanem sprzed zmiany cytuje
  ten SHA, nigdy `HEAD` (`context/foundation/lessons.md` §„Linię bazową strażnika kotwicz na jawnym SHA")
- Badanie: `context/changes/testing-reviewer-path-e2e/research.md`
- Tożsamość zmiany i odrzucony artefakt: `context/changes/testing-reviewer-path-e2e/change.md`
- Plan testów: `context/foundation/test-plan.md` — §1 (zasady), §2 wiersz #4 i jego Risk Response,
  §3 wiersz 4, §4, §5, §6.2 (wzorzec do naśladowania), §6.6, §7
- Lekcje wiążące kryteria tej zmiany: `context/foundation/lessons.md` §„Strażnik, który jest zielony
  na commicie bazowym", §„Strażnik musi mierzyć to, co deklaruje", §„Linię bazową strażnika kotwicz
  na jawnym SHA"
- Wzorzec sondy mutacyjnej: `scripts/probe-save-barrier.sh`, `scripts/probe-save-barrier.patch`,
  oraz `context/archive/2026-09-07-testing-save-barrier/plan.md:131-157` (zamrożony hunk) i
  `reviews/plan-review.md:29-49` (F1, która wymusiła łatkę zamiast prozy)
- Wzorzec dymu i historia rozjazdu potwierdzania: `context/deployment/deploy-plan.md` §3, §5, §6
  (`:94-139`), pozycja długu `:234-235`, `security.checkOrigin` `:209-212`
- Założenie Fazy 2, którego ta faza **nie** unieważnia:
  `context/archive/2026-09-07-test-plan-refresh/plan-brief.md:79`
- Mechanika, na której stoi strażnik: `node_modules/@cloudflare/vite-plugin/dist/index.mjs:53072`
  i `:48466`; `node_modules/wrangler/wrangler-dist/cli.js:297455`;
  `node_modules/playwright/lib/runner/index.js:6321-6326`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw kroków. Zobacz `references/progress-format.md`.

### Faza 1: Osprzęt uruchomieniowy i strażnik stosu

#### Automatyczne

- [ ] 1.1 Strażnik czerwieni się na stanie bazowym (`.env` na hostowanym → odmowa #2, nie pad testu)
- [ ] 1.2 Odmowa #1 wiąże (root `.dev.vars` istnieje)
- [ ] 1.3 Odmowa #3 wiąże (build zamrożony na innym stosie)
- [ ] 1.4 Odmowa #4 wiąże (stos zatrzymany)
- [ ] 1.5 Po `.env` lokalnym + `npm run build`: `npx playwright test` startuje aplikację z konfiguracji
- [ ] 1.6 `npx tsc --noEmit` zielone
- [ ] 1.7 `npm run lint` zielone
- [ ] 1.8 `git status --porcelain` czyste poza gitignorowanym `.env`

#### Ręczne

- [ ] 1.9 Docstring `playwright.config.ts` nie obiecuje niczego, czego faza nie dowozi
- [ ] 1.10 Cztery komunikaty odmów są rozróżnialne i mówią, co zrobić

### Faza 2: Test ścieżki recenzenta bez zewnętrznych zmiennych

#### Automatyczne

- [ ] 2.1 Dwa zielone przebiegi pod rząd bez `E2E_EMAIL`/`E2E_PASSWORD` w środowisku
- [ ] 2.2 Strażnik zniknięcia zmiennych: czerwony na `e136707`, zielony na HEAD
- [ ] 2.3 Nowy test wiąże gałąź produkcyjną (`Check your email` obecne na HEAD, nieobecne na `e136707`)
- [ ] 2.4 `npx tsc --noEmit` i `npm run lint` zielone
- [ ] 2.5 Niezmiennik antywzorców w `e2e/` (zielony na bazie świadomie — nie dowód tej fazy)

#### Ręczne

- [ ] 2.6 Przebieg `--headed`: ekran po rejestracji pokazuje „Check your email"
- [ ] 2.7 Komentarze o granicy (rejestracja jako osprzęt; czego nowy test nie dowodzi) są czytelne

### Faza 3: Kontrola mutacyjna e2e

#### Automatyczne

- [ ] 3.1 `git apply --check scripts/probe-reviewer-path.patch` przechodzi na czystym drzewie
- [ ] 3.2 `scripts/probe-reviewer-path.sh` kończy się zerem (zielony → czerwony → zielony wykazane)
- [ ] 3.3 Odmowa na brudnym `src/lib/supabase.ts` wiąże (exit 2, drzewo nietknięte)
- [ ] 3.4 Odmowa na zajętym porcie wiąże (exit 6)
- [ ] 3.5 Drzewo czyste po przebiegu **oraz** po przerwaniu sygnałem w trakcie przebiegu 2
- [ ] 3.6 `npm run lint` zielone

#### Ręczne

- [ ] 3.7 Wyjście przebiegu 2 wymienia nazwy padłych testów
- [ ] 3.8 Trzy kody wyjścia dają trzy różne, czytelne komunikaty

### Faza 4: Dym produkcyjny egzekwowalny

#### Automatyczne

- [ ] 4.1 Trzy sondy bezmailowe przechodzą przeciwko produkcji (3/3 przed bramą ręczną)
- [ ] 4.2 Odmowa zera wiąże: przebieg bez terminala kończy się niezerowo
- [ ] 4.3 Odmowa na złym dowodzie wiąże (adres bez `code=` albo na innym hoście)
- [ ] 4.4 Sekcje historyczne `deploy-plan.md` nietknięte wobec `e136707`

#### Ręczne

- [ ] 4.5 Pełny przebieg dymu przeciwko produkcji wykonany, werdykt oddany skryptowi
- [ ] 4.6 Konto testowe usunięte, w tym konta z poprzednich zmian
- [ ] 4.7 Kroki ręczne wypisane przez skrypt dają się wykonać bez zaglądania do planu

### Faza 5: Przewodnik, bramki i przegląd zimnego czytelnika

#### Automatyczne

- [ ] 5.1 §6.6 nie zawiera `TBD`
- [ ] 5.2 §6.6 ma wszystkie siedem pól
- [ ] 5.3 §3 wiersz 4 nie ma `not started`; strażnik czerwony na `e136707`
- [ ] 5.4 §5 nie wiąże e2e z `CI on PR`; strażnik czerwony na `e136707`
- [ ] 5.5 §1 i §7 `test-plan.md` nietknięte wobec `e136707`
- [ ] 5.5a §8 `Strategy (§1–§5) last reviewed` przedatowane; linia `Ostatni refresh` identyczna
      jak w `e136707`; §8 nazywa osłabiony wiersz §5 i odsyła do tego folderu zmiany
- [ ] 5.6 `ci.yml` nietknięty wobec `e136707`
- [ ] 5.7 `AGENTS.md` zmieniony o dopisek, bez przepisania istniejącej reguły
- [ ] 5.8 `npm run lint`, `npx tsc --noEmit`, `npm test` zielone; `prettier --check` na dotkniętych `.md`

#### Ręczne

- [ ] 5.9 Przegląd zimnego czytelnika wykonany na 1–3 ekranach, werdykty w §6.7
- [ ] 5.10 §6.6 wystarcza komuś, kto ma napisać drugi test e2e
- [ ] 5.11 §5 wiersz e2e czyta się jako decyzja z powodem, nie jak niedokończona robota
- [ ] 5.12 Nota §6.7 mówi, czego faza się nauczyła, a nie co zrobiła
