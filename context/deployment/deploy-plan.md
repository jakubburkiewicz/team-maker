---
project: team-maker
platform: Cloudflare Workers (static assets)
worker_name: team-maker
account_id: e9b0684b22298d5579d36a56e148c764
production_url: https://team-maker.jakub-e9b.workers.dev
deployed_at: 2026-08-30
deployed_version: aed419ac-4095-4fae-860c-781a1c7bf024
previous_version: 9112a31c-c0df-44ef-9acf-3e99cfd46ea1
status: deployed-and-verified
context_type: mvp
---

# Plan wdrożenia — pierwsze wypuszczenie produkcyjne

Ścieżka audytu „co miało się wydarzyć" dla pierwszego wdrożenia team-maker na Cloudflare Workers.
Plan zatwierdzony przez człowieka w Plan Mode przed wykonaniem; wyniki dopisane po wykonaniu.

Źródła decyzji: `context/foundation/infrastructure.md` (wybór platformy, rejestr ryzyk),
`context/foundation/tech-stack.md` (`deployment_target: cloudflare-workers`).

## Stan zastany przed wdrożeniem

| Krok z `infrastructure.md` → Getting Started | Stan                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Nazwa workera `team-maker`                | Już poprawiona w `wrangler.jsonc` (nie `10x-astro-starter`)                                    |
| 2. `wrangler login` + sekrety produkcyjne    | Zalogowany jako `jakub@burkiewicz.eu`; `SUPABASE_URL` i `SUPABASE_KEY` obecne w Workers Secrets |
| 3. Sekrety lokalne                           | W `.env` (gitignored). Wrangler 4.90 czyta `.env` równolegle z `.dev.vars` — patrz Odchylenia   |
| 4. Build i deploy                            | Wykonane w tej sesji                                                                            |
| 5. Weryfikacja                               | Wykonana w tej sesji                                                                            |

Worker istniał już wcześniej: `wrangler deployments list` pokazywał upload z 2026-08-29
(wersja `88053193…`) plus dwie zmiany sekretów. To wdrożenie jest pierwszym **zweryfikowanym**,
nie pierwszym w ogóle.

## Wykonane kroki

### 1. Build

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
npx astro sync && npm run lint && npm run build
```

Wynik: przeszło bez błędów. Jedno ostrzeżenie: `@astrojs/sitemap` pomija generowanie, bo
`astro.config.mjs` nie ma opcji `site`.

### 2. Upload wersji preview (bez ruchu produkcyjnego)

```bash
npx wrangler versions upload
```

- **Version ID**: `aed419ac-4095-4fae-860c-781a1c7bf024`
- **Preview URL**: `https://aed419ac-team-maker.jakub-e9b.workers.dev` (publiczny)
- Worker Startup Time: 23 ms; upload 1910.95 KiB / gzip 390.97 KiB
- Bindingi: `env.SESSION` (KV, **inherited** — istniejący namespace `79681b67cdd64767acadb8d9d1e9af15`,
  nie powstał duplikat), `env.IMAGES`, `env.ASSETS`

### 3. Smoke test na preview — wynik: 4/4

| Test                                       | Oczekiwane                       | Wynik                                              |
| ------------------------------------------ | -------------------------------- | -------------------------------------------------- |
| `GET /`                                    | 200                              | ✅ 200                                              |
| `GET /dashboard` bez sesji                 | 302 → `/auth/signin`             | ✅ 302 → `/auth/signin`                             |
| `POST /api/auth/signin` (fałszywe dane)    | `?error=Invalid login credentials` | ✅ `?error=Invalid%20login%20credentials`          |
| `GET /_worker.js/index.js`                 | 404                              | ✅ 404                                              |

### 4. Promocja na produkcję

```bash
npx wrangler versions deploy aed419ac-4095-4fae-860c-781a1c7bf024@100% --yes
```

Wynik: `SUCCESS  Deployed team-maker version aed419ac-… at 100% (3.22 sec)`.
`observability.enabled: true` zsynchronizowane, `logpush: false`.

### 5. Weryfikacja na produkcji — wynik: 5/5

URL produkcyjny: **https://team-maker.jakub-e9b.workers.dev**

| Test                                    | Wynik                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| `GET /`                                 | 200                                                             |
| `GET /auth/signin`                      | 200                                                             |
| `GET /dashboard` bez sesji              | 302 → `/auth/signin`                                            |
| `POST /api/auth/signin` (fałszywe dane) | 302 → `/auth/signin?error=Invalid%20login%20credentials`        |
| `GET /_worker.js/index.js`              | 404                                                             |
| Nagłówki na trasie SSR `/`              | brak `Cache-Control`, brak `cf-cache-status` — żadna reguła cache |

`npx wrangler deployments list` potwierdza `(100%) aed419ac-4095-4fae-860c-781a1c7bf024`
z 2026-08-30T10:28:50Z.

### 6. Ręczne przejście przez przeglądarkę — potwierdzone przez użytkownika

Pełna ścieżka wykonana w przeglądarce i złapana przez `npx wrangler tail`. **Każde żądanie `Ok`,
zero wyjątków, zero `1102 Worker exceeded resource limits`:**

```
GET  /                        Ok   12:32:13
GET  /auth/signin             Ok   12:32:15
GET  /auth/signup             Ok   12:32:20
POST /api/auth/signup         Ok   12:32:50
GET  /auth/confirm-email      Ok   12:32:51
GET  /?code=REDACTED          Ok   12:33:40   ← link potwierdzający z e-maila
GET  /auth/signin             Ok   12:33:48
POST /api/auth/signin         Ok   12:34:00
GET  /                        Ok   12:34:00
GET  /dashboard               Ok   12:34:07   ← serwowane, nie przekierowane → sesja działa
GET  /dashboard               Ok   12:34:30
POST /api/auth/signout        Ok   12:34:31
GET  /                        Ok   12:34:31
```

To domyka ryzyko „przekroczenie 10 ms CPU → losowe 5xx" na poziomie pojedynczej sesji: middleware
woła `supabase.auth.getUser()` przy każdym z tych żądań i mieści się w limicie. Ryzyko pozostaje
otwarte pod współbieżnym ruchem.

**Rozbieżność wykryta przy okazji — rozstrzygnięta zmianą decyzji w PRD.** Ścieżka zawiera
`/auth/confirm-email` i powrót przez `/?code=…`, czyli **potwierdzenie adresu e-mail jest wymagane**.
`prd.md` rozstrzygał odwrotnie (Access Control + FR-001: konto aktywne natychmiast).

Rozstrzygnięcie 2026-08-30: **zostawiamy potwierdzanie i poprawiamy PRD**, bo to zachowanie domyślne
Supabase, które działa out-of-the-box — wyłączenie go byłoby świadomą zmianą konfiguracji produkcyjnego
auth, czyli kosztem, nie oszczędnością. `prd.md` zaktualizowany: FR-001 nosi wpis „Zmiana decyzji
2026-08-30", sekcja Access Control opisuje faktyczną ścieżkę. Ryzyko z pierwotnego uzasadnienia
(persona główna wchodzi raz, zależność od dostarczalności poczty) jest przyjęte świadomie.

**Uwaga do zachowania:** kliknięcie linku potwierdzającego **nie loguje**. Supabase potwierdza konto
po swojej stronie i przekierowuje na `/?code=…`, ale aplikacja nie wymienia tego kodu na sesję —
`src/pages/index.astro` renderuje samo `Welcome`. Gracz ląduje na stronie głównej jako niezalogowany
i musi przejść przez `/auth/signin` (widać to w logach: 12:33:40 `/?code=` → 12:33:48 `/auth/signin`).
Ścieżka działa, ale ma jeden krok więcej niż mogłaby.

**Uwaga do konfiguracji:** `supabase/config.toml` ma `enable_confirmations = false` (linia 209) — to
dotyczy wyłącznie lokalnego stacku `supabase start`. Plik i produkcja rozjeżdżają się w tym polu
świadomie. **Nie uruchamiaj `supabase config push`** bez wcześniejszej poprawki: wypchnęłoby to
`site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]`
i limit `email_sent = 2` na produkcję, kierując produkcyjne linki mailowe na localhost.

**Stan zlinkowania (zmiana 2026-09-05, F-02 `solvable-character-pool`):** projekt hostowany
(`ifytodkdnzgsflptiyfx`) **jest zlinkowany** — `supabase link` wykonano, żeby `supabase db push`
zastosował pierwsze migracje projektu (`supabase/migrations/20260905081500_character_pool_schema.sql`
i `20260905081600_character_pool_seed.sql`). Zweryfikowano po push: `characters` = 12, `perks` = 36,
RLS włączone z jedną polityką `SELECT` na tabelę, potwierdzanie adresu e-mail nadal działa.
Zakaz `config push` obowiązuje bez zmian — a po zlinkowaniu jest o jedno polecenie bliżej
i łatwiejszy do przypadkowego uruchomienia (CLI potrafi go sugerować po `link`). Jedyną ścieżką
zmian w hostowanej bazie pozostaje `supabase db push` z plików w `supabase/migrations/`.

**Oczekuje na `db push` (przegląd implementacji F-02, 2026-09-05):** trzecia migracja
`20260905090700_character_pool_revoke_writes.sql` — `revoke insert, update, delete, truncate`
na `characters` i `perks` dla `anon`/`authenticated` (obrona w głąb obok RLS). Istnieje tylko
w repozytorium; na produkcję trafi przy następnym `supabase db push`. Po zastosowaniu usuń ten
akapit i dopisz ją do listy powyżej.

## Rozstrzygnięcia wobec rejestru ryzyk z `infrastructure.md`

| Wpis w rejestrze                                        | Rozstrzygnięcie                                                                                                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wdrożenie pod nazwą `10x-astro-starter`                 | **Nie wystąpiło.** Nazwa poprawiona przed uploadem; worker to `team-maker`.                                                                                                                                        |
| Cichy brak sekretów → auth martwy przy zielonym deployu | **Wykluczone testem.** `POST /api/auth/signin` zwraca `Invalid login credentials` (odpowiedź Supabase), a nie `Supabase is not configured` (ścieżka `supabase === null` w `src/pages/api/auth/signin.ts`).          |
| Serwowanie `_worker.js` jako pliku statycznego          | **Nie wystąpi z konstrukcji.** Build tworzy `dist/.wrangler/deploy/config.json`, który przekierowuje wrangler na `dist/server/wrangler.json` z `assets.directory: "../client"`. `dist/client/` zawiera wyłącznie `_astro/`, `favicon.png`, `template.png`. Potwierdzone testem: 404. |
| Nieoczekiwany binding KV `SESSION`                      | **Zmaterializowane wcześniej, nieszkodliwe.** Namespace `SESSION` (`79681b67cdd64767acadb8d9d1e9af15`) powstał przy deployu 08-29; obecny upload go dziedziczy. Adapter dokłada też binding `IMAGES`.                |
| Cache odpowiedzi z `Set-Cookie`                         | **Brak ekspozycji.** Żadna Cache Rule nie została dodana; trasa SSR nie zwraca `Cache-Control` ani `cf-cache-status`.                                                                                              |
| Agent użyje `wrangler pages deploy`                     | **Nie wystąpiło.** Użyto `versions upload` + `versions deploy`. Reguła jest już zapisana w `AGENTS.md`.                                                                                                             |
| CI nie uruchamia się (trigger `master`)                 | **Nieaktualne.** `.github/workflows/ci.yml` triggeruje na `main` dla push i PR.                                                                                                                                     |
| Publiczne preview URL na produkcyjnej bazie Supabase    | **Otwarte, świadomie zaakceptowane.** `https://aed419ac-team-maker.jakub-e9b.workers.dev` jest publiczny i wskazuje na tę samą bazę. Cloudflare Access nie skonfigurowany.                                          |
| Przekroczenie 10 ms CPU → losowe 5xx (`1102`)           | **Otwarte, niezweryfikowane.** Wymaga realnego ruchu przez `wrangler tail`. Startup 23 ms; middleware woła `supabase.auth.getUser()` przy każdym żądaniu.                                                          |
| Rollback kodu bez rollbacku schematu Supabase           | **Nie dotyczy tego wdrożenia** — nie zmieniano schematu ani polityk RLS.                                                                                                                                            |
| Podbicie `compatibility_date`                           | **Nie dotknięte.** Pozostaje `2026-05-08`.                                                                                                                                                                          |

## Odchylenia od `infrastructure.md`

1. **`.dev.vars` nie został utworzony.** Sekrety lokalne żyją w `.env`. Wrangler 4.90 ładuje `.env`
   tą samą ścieżką co `.dev.vars` (`loadDotEnv` w `wrangler-dist/cli.js`, komunikat
   „Using secrets defined in .env"), więc drugi plik z tymi samymi poświadczeniami nic nie dodaje.
   `.env` i `.dev.vars` są oba w `.gitignore`. **Hard rule w `AGENTS.md` mówiąca, że sekrety lokalne
   żyją w `.dev.vars`, wymaga korekty.**
2. **`wrangler deploy` NIE wstrzykuje `.env` jako jawnych `vars`.** `--dry-run` raportuje dokładnie
   trzy bindingi i zero `vars`; sekrety pozostają w Workers Secrets.
3. **Wpis `"directory": "./dist"` w `wrangler.jsonc` jest martwy** — nadpisany przez wygenerowany
   `dist/server/wrangler.json`. Mylący, ale nieszkodliwy.
4. **Node w domyślnej powłoce to v20.19.0**, a wrangler wymaga ≥22 (`.nvmrc`: 22.14.0). Bez
   `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"` każda komenda wrangler odmawia startu.

## Odkrycia poza zakresem badań

- **Astro `security.checkOrigin` jest aktywne.** `POST /api/auth/signin` bez nagłówka `Origin`
  zwraca **403 „Cross-site POST form submissions are forbidden"** — zanim kod trasy w ogóle zostanie
  wykonany. Ma to znaczenie dla każdego testu automatycznego uderzającego w API auth: bez `Origin`
  testuje się CSRF, nie logowanie. Formularze POST-ujące natywnie z tej samej domeny działają normalnie.

## Pętla operacyjna

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"   # wymagane, patrz Odchylenia #4

npx wrangler versions upload                    # preview, bez ruchu produkcyjnego
npx wrangler versions deploy <ID>@100% --yes    # promocja
npx wrangler deployments list                   # historia
npx wrangler rollback 9112a31c-c0df-44ef-9acf-3e99cfd46ea1   # odwrót do wersji sprzed tego wdrożenia
npx wrangler tail                               # logi runtime na żywo
npx wrangler secret put <NAZWA>                 # rotacja sekretu (tworzy nową wersję → wymaga deployu)
```

`wrangler deploy` (jeden krok, od razu 100% ruchu) też działa. **`wrangler pages deploy` jest błędne** —
adapter Astro 6 nie obsługuje Cloudflare Pages.

## Otwarte po tym wdrożeniu

- **Monitoring `1102` pod ruchem współbieżnym.** Pojedyncza sesja przeszła czysto (13 żądań, wszystkie `Ok`).
  Reakcja w razie wystąpienia: Workers Paid $5/mies., limit 30 s CPU.
- **Konto testowe w produkcyjnej bazie.** Ręczna weryfikacja utworzyła realne konto — do usunięcia przed
  oddaniem projektu, żeby recenzent nie oglądał danych testowych.
- **Niewymieniany kod PKCE po potwierdzeniu e-maila.** Link z maila prowadzi na `/?code=…`, ale
  aplikacja nie wymienia kodu na sesję, więc gracz ląduje niezalogowany i musi przejść przez
  `/auth/signin`. Do rozważenia przy implementacji: obsłużyć `?code=` i zalogować od razu.
  Skraca ścieżkę personie głównej o jeden krok.
- **Korekta hard rule o `.dev.vars` w `AGENTS.md`** (Odchylenie #1).
- **Auto-deploy po scaleniu do `main`** — `tech-stack.md` deklaruje `ci_default_flow: auto-deploy-on-merge`,
  ale CI dziś tylko lintuje i buduje. Wymaga `CLOUDFLARE_API_TOKEN` w GitHub Secrets, ograniczonego
  do edycji tego jednego workera.
- **Porządki**: martwy `"directory": "./dist"` w `wrangler.jsonc`, brakujące `site` w `astro.config.mjs`.
- **Cloudflare Access na preview URL** — jeśli w bazie pojawią się dane realne.
