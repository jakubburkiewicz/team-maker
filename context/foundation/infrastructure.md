---
project: team-maker
researched_at: 2026-08-30
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19 islands
  runtime: workerd (Cloudflare Workers)
---

## Recommendation

**Wdrażaj na Cloudflare Workers.**

Projekt jest już pod nie skonfigurowany — `astro.config.mjs` deklaruje `adapter: cloudflare()`,
a `wrangler.jsonc` wskazuje `main: "@astrojs/cloudflare/entrypoints/server"` z bindingiem `assets`;
żadna inna platforma nie startuje z zerowym kosztem migracji. Cloudflare jako jedyna z sześciu
kandydatek zaliczyła wszystkie pięć kryteriów przyjaznych agentowi, ma bezterminowo darmowy próg
(100 tys. żądań na dobę, statyki nielimitowane) — co odpowiada na wywiad Q2 „minimalizuj koszt" —
oraz publikuje `llms.txt` i dwa oficjalne serwery MCP (`docs.mcp.cloudflare.com`,
`observability.mcp.cloudflare.com`). Q3 (istniejąca znajomość Cloudflare) rozstrzygnął remis
z Vercelem; Q4 („jeden region wystarczy") nie dał Cloudflare bonusu za edge, a Q5 („zewnętrzni
dostawcy OK") wykluczył przewagę kolokacji, którą oferowałyby Railway i Render.

**Uwaga krytyczna dla całego łańcucha:** `tech-stack.md` deklaruje `deployment_target: cloudflare-pages`,
ale adapter Astro 6 **nie wspiera już Cloudflare Pages**. Celem jest Workers ze static assets,
a komendą wdrożenia `wrangler deploy` — nie `wrangler pages deploy`. Te dwie ścieżki nie są zamienne.

## Platform Comparison

Twarde filtry: odpowiedź Q1 („brak trwałych połączeń") nie wyeliminowała nikogo. Realnym filtrem
okazał się runtime: projekt jest zbudowany pod `workerd` przez `@astrojs/cloudflare`, więc Fly.io,
Railway i Render wymagałyby podmiany na `@astrojs/node` plus kontener — koszt migracji, którego
przy dwutygodniowym oknie MVP nic nie uzasadnia.

| Platforma              | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integracja | Razem              |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | ---------------- | ------------------ |
| **Cloudflare Workers** | Pass      | Pass               | Pass                | Pass              | Pass             | **5 Pass**         |
| Vercel                 | Pass      | Pass               | Pass                | Pass              | Partial          | 4 Pass / 1 Partial |
| Netlify                | Pass      | Pass               | Partial             | Pass              | Pass             | 4 Pass / 1 Partial |
| Fly.io                 | Pass      | Partial            | Pass                | Pass              | Fail             | 3 / 1 / 1          |
| Railway                | Pass      | Pass               | Partial             | Partial           | Fail             | 2 / 2 / 1          |
| Render                 | Partial   | Pass               | Partial             | Partial           | Fail             | 1 / 3 / 1          |

**Cloudflare Workers.** `wrangler` (4.90 w devDependencies) pokrywa pełną pętlę operacyjną bez
panelu: `deploy`, `versions upload`, `rollback`, `tail`, `secret put`. Dokumentacja jest dostępna
jako `llms.txt`, a dwa serwery MCP dają dostęp strukturalny do dokumentacji i do logów. Deploy jest
deterministyczny i wersjonowany. Jedyny minus to model kosztu CPU: 10 ms na wywołanie na darmowym
progu, przy middleware wołającym `supabase.auth.getUser()` na każdym żądaniu.

**Vercel.** Oficjalny `@astrojs/vercel` v10 pod Astro 6, znakomite DX i wersjonowane wdrożenia
z natychmiastowym rollbackiem. Dwa problemy przy tych ograniczeniach: plan Hobby zabrania użycia
komercyjnego (dla projektu zaliczeniowego to formalnie OK, ale jest to zależność od interpretacji
regulaminu), a wejście na Pro kosztuje $20/mies. przy Q2 = „minimalizuj koszt". Vercel MCP jest
w wersji beta (status sprawdzony 2026-08-30) — stąd Partial na piątym kryterium.

**Netlify.** Oficjalny adapter i dojrzały serwer MCP, ale free tier przeszedł w 2026 r. na model
kredytowy: ~300 kredytów miesięcznie, czyli około 20 wdrożeń produkcyjnych, a po ich wyczerpaniu
plan **przestaje serwować ruch** zamiast dławić. Przy iteracyjnym MVP to twardy sufit. Do tego
SSR działa na funkcjach Lambda-style z mierzonymi zimnymi startami rzędu 800 ms–1,5 s.

**Fly.io.** Świetne CLI (`flyctl`) i dokumentacja w GitHubie, ale to PaaS kontenerowy — wymaga
`@astrojs/node` i obrazu, czyli dokładnie tego, co ta analiza ma poza zakresem. Brak darmowego
progu po 7-dniowym triallu (najmniejsza maszyna ~$2/mies. utrzymywana non-stop). Bez serwera MCP.

**Railway.** Najlepsze DX w klasie kontenerowej i kolokowane bazy — ale Q5 („zewnętrzni dostawcy OK",
Supabase już wybrany) unieważnia tę przewagę, a free tier nie istnieje: po 30-dniowym kredycie $5
zostaje $1 zużycia miesięcznie, plan Hobby to $5/mies.

**Render.** Ma prawdziwy darmowy plan, ale usypia usługę po 15 minutach bezczynności i budzi ją
około minuty. Persona główna PRD to recenzent wchodzący **raz** — minuta białego ekranu na pierwsze
wejście dyskwalifikuje ten wariant, mimo że jest darmowy.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Zero kosztu migracji (konfiguracja już w repo), zero kosztu miesięcznego, komplet pięciu kryteriów,
znajomość po stronie dewelopera. Wersjonowane wdrożenia z `wrangler rollback` dają realną ścieżkę
odwrotu, a `observability` jest już włączone w `wrangler.jsonc`.

#### 2. Vercel

Wygrywa na czystym DX i na tym, że preview deploys są tam pierwszorzędnym obywatelem, a nie rzeczą
do dokonfigurowania. Przegrywa na koszcie powyżej Hobby, na ograniczeniu komercyjnym Hobby oraz na
tym, że wymaga podmiany adaptera w projekcie, który już działa gdzie indziej.

#### 3. Netlify

Wygrywa na dojrzałości integracji agentowej (serwer MCP rekomendowany obok CLI). Przegrywa na
sufcie kredytowym darmowego planu, który przy dwutygodniowym sprincie MVP jest realnym ryzykiem
zatrzymania ruchu, oraz na zimnych startach funkcji.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`wrangler.jsonc` ma `name: "10x-astro-starter"`** — nazwę startera, nie projektu. Pierwszy
   `wrangler deploy` opublikuje worker pod tym adresem; późniejsza zmiana nazwy **tworzy nowy
   worker**, a stary zostaje osierocony wraz z ustawionymi w nim sekretami. Nazwę należy poprawić
   przed pierwszym wdrożeniem, nie po nim.
2. **Cichy tryb awarii na sekretach.** `SUPABASE_URL` i `SUPABASE_KEY` są `optional: true` w schemacie
   `astro:env`, więc `createClient()` w `src/lib/supabase.ts` zwraca `null`, gdy ich brak. Wdrożenie
   przejdzie na zielono, strona się otworzy, `context.locals.user` będzie zawsze `null`, a każda trasa
   z `PROTECTED_ROUTES` zacznie przekierowywać na `/auth/signin` — bez jednego błędu w logach.
3. **Set-Cookie a cache na brzegu.** `@supabase/ssr` odświeża JWT i zapisuje go nagłówkiem `Set-Cookie`.
   Jeżeli jakakolwiek reguła cache obejmie odpowiedź SSR, sesja jednego konta może trafić do drugiego —
   bezpośrednie złamanie Guardrail izolacji danych i US-04, czyli jedynej rzeczy, którą ten projekt ma
   udowodnić.
4. **Limit 10 ms CPU na wywołanie (plan darmowy).** `src/middleware.ts` woła `supabase.auth.getUser()`
   przy **każdym** żądaniu. Samo oczekiwanie na I/O nie liczy się do CPU, ale weryfikacja JWT
   i deserializacja odpowiedzi już tak. Przekroczenie objawia się jako losowe 5xx
   (`1102 Worker exceeded resource limits`), a nie jako czytelny komunikat.
5. **Cała dokumentacja Cloudflare Pages jest dla tego projektu aktywnie błędna.** Adapter Astro 6
   porzucił wsparcie dla Pages, a `tech-stack.md` wciąż deklaruje `cloudflare-pages`. Każdy tutorial
   z `wrangler pages deploy` zepsuje wdrożenie — i jest to dokładnie ta klasa treści, którą agent
   najchętniej cytuje z pamięci.
6. **CI dziś nie działa.** `.github/workflows/ci.yml` triggeruje na `master`, a gałąź to `main`.
   Deklarowany w `tech-stack.md` `ci_default_flow: auto-deploy-on-merge` nie istnieje w praktyce.

### Pre-Mortem — How This Could Fail

Pierwszy `wrangler deploy` poszedł gładko, pod nazwą `10x-astro-starter`. Sekrety Supabase trafiły
do Workers Secrets dopiero po fakcie, więc przez dwa dni aplikacja odsyłała każdego odwiedzającego
na ekran logowania — bez błędu, bo `createClient()` po cichu zwracał `null`, a `PROTECTED_ROUTES`
zadziałało dokładnie zgodnie z kodem. Potem nazwa workera została poprawiona na `team-maker`;
powstał drugi worker, a stary został z sekretami i z adresem, który zdążył już trafić do zgłoszenia
projektu. Preview URL na `workers.dev`, publiczny domyślnie, wskazywał na tę samą produkcyjną bazę
Supabase, więc konta testowe zaśmieciły dane oglądane później przez recenzenta. Przy okazji dodano
regułę cache na stronie głównej, żeby przyspieszyć pierwsze wejście — i odpowiedź z nagłówkiem
`Set-Cookie` została podana drugiemu użytkownikowi, co unieważniło jedyny guardrail, którego projekt
miał dowodzić. `wrangler rollback` cofnął kod workera w dziesięć sekund, ale nie cofnął zmienionych
polityk RLS po stronie Supabase — połowa stanu żyła u zupełnie innego dostawcy. Ostatecznie nie
zabrakło ani skali, ani pieniędzy. Zabrakło jednego: nic nie zawiodło głośno.

### Unknown Unknowns

- **`wrangler dev` jest zbędne, a `.dev.vars` obowiązkowe.** W Astro 6 `astro dev` i `astro preview`
  używają pluginu Vite Cloudflare i prawdziwego `workerd`. To znaczy też, że lokalnie sekrety nie
  pochodzą z Workers Secrets — potrzebny jest plik `.dev.vars` (nie `.env`), inaczej lokalny auth
  milczy tak samo jak produkcyjny.
- **Preview URL są domyślnie publiczne.** Powstają przy każdym `wrangler deploy` i `wrangler versions
upload`, są indeksowalne i wskazują na tę samą bazę Supabase co produkcja. Ograniczyć je może tylko
  Cloudflare Access.
- **Adapter sam konfiguruje binding KV `SESSION`** i potrafi auto-provisionować namespace przy
  wdrożeniu. W `wrangler.jsonc` nie ma po tym śladu — pojawi się zasób, o którym nikt nie zdecydował
  świadomie.
- **`assets.directory` wskazuje `./dist`, gdzie leży też `_worker.js`.** To znany punkt zapalny
  (withastro/astro#13582) — przy błędnej konfiguracji kod serwera bywa serwowany jako plik statyczny.
- **`compatibility_date` jest przypięta na `2026-05-08`.** Jej podbicie może zmienić zachowanie
  polyfilli `nodejs_compat`, od których zależy `@supabase/ssr` (zgłoszony błąd „dynamic require of
  stream is not supported", supabase/supabase#37592). Zmiana jednej linijki o zasięgu całej aplikacji.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload` tworzy wersję bez kierowania na nią ruchu
  produkcyjnego i zwraca URL w formacie `<prefiks-wersji>-team-maker.<subdomena>.workers.dev`.
  Działa na planie darmowym i nie wymaga Workers Builds. **Te adresy są publiczne** — ochrona wymaga
  skonfigurowania Cloudflare Access na poziomie workera lub konta. Preview korzystają z tych samych
  sekretów, a więc z tej samej bazy Supabase co produkcja.
- **Secrets**: `npx wrangler secret put SUPABASE_URL` i `npx wrangler secret put SUPABASE_KEY` —
  wartości trafiają do Workers Secrets, są zaszyfrowane i nieodczytywalne po zapisie (`wrangler secret
list` pokazuje tylko nazwy). Lokalnie te same klucze idą do `.dev.vars` w katalogu projektu (nigdy
  do repozytorium). Dla CI: GitHub Secrets `SUPABASE_URL` / `SUPABASE_KEY` plus `CLOUDFLARE_API_TOKEN`
  ograniczony do edycji tego jednego workera. Rotacja to ponowne `wrangler secret put` — tworzy nową
  wersję workera, więc wymaga wdrożenia.
- **Rollback**: `npx wrangler deployments list` pokazuje historię, `npx wrangler rollback [VERSION_ID]`
  cofa do wskazanej wersji. Czas powrotu: sekundy. **Zastrzeżenie dotyczące danych**: rollback cofa
  wyłącznie kod workera. Migracje schematu i polityki RLS w Supabase nie cofają się automatycznie —
  po każdej zmianie w bazie rollback kodu może zostawić aplikację niezgodną ze schematem.
- **Approval**: agent może bez nadzoru wykonywać `wrangler versions upload` (preview), `wrangler tail`,
  `wrangler deployments list`, `npm run lint`, `npm run build`. Człowiek wykonuje ręcznie: pierwsze
  `wrangler deploy` na produkcję, `wrangler secret put` z wartością sekretu, rotację klucza Supabase,
  usunięcie workera, każdą zmianę polityk RLS oraz `wrangler rollback` na produkcji.
- **Logs**: `npx wrangler tail` streamuje logi runtime na żywo (tryb tylko do odczytu, bez modyfikacji
  workera). `observability.enabled: true` jest już ustawione w `wrangler.jsonc`, więc logi trafiają też
  do panelu Workers Observability. Strukturalny dostęp dla agenta: serwer MCP
  `https://observability.mcp.cloudflare.com/mcp` (przeszukiwanie logów i wyjątków); dokumentacja przez
  `https://docs.mcp.cloudflare.com/mcp` lub `https://developers.cloudflare.com/workers/llms.txt`.

## Risk Register

| Risk                                                                              | Source           | Likelihood | Impact | Mitigation                                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Wdrożenie pod nazwą `10x-astro-starter`, potem osierocony worker po zmianie nazwy | Devil's advocate | H          | M      | Zmień `name` na `team-maker` w `wrangler.jsonc` **przed** pierwszym `wrangler deploy`; zweryfikuj `wrangler deployments list` po wdrożeniu   |
| Cichy brak sekretów → auth martwy przy zielonym deployu                           | Devil's advocate | H          | H      | Po każdym wdrożeniu wykonaj smoke test: rejestracja + logowanie + zapis drużyny. Rozważ log ostrzegawczy, gdy `createClient()` zwraca `null` |
| Cache odpowiedzi z `Set-Cookie` → wyciek sesji między kontami                     | Devil's advocate | L          | H      | Nie dodawaj Cache Rules na trasach SSR; utrzymuj `Cache-Control: private, no-store` na odpowiedziach z sesją; test dwoma kontami z US-04     |
| Publiczne preview URL wskazujące na produkcyjną bazę Supabase                     | Unknown unknowns | M          | M      | Włącz Cloudflare Access na preview URL albo świadomie zaakceptuj publiczność i nie umieszczaj w bazie danych realnych                        |
| Przekroczenie 10 ms CPU na darmowym planie → losowe 5xx                           | Devil's advocate | M          | M      | Monitoruj `wrangler tail` pod kątem `1102`; w razie wystąpienia przejdź na Workers Paid ($5/mies., limit 30 s CPU)                           |
| Agent użyje `wrangler pages deploy` z nieaktualnej dokumentacji                   | Devil's advocate | H          | M      | Popraw `deployment_target` w `tech-stack.md` na `cloudflare-workers`; zapisz w `AGENTS.md`, że komendą wdrożenia jest `wrangler deploy`      |
| CI nie uruchamia się (trigger `master`, gałąź `main`)                             | Research finding | H          | L      | Zmień trigger w `.github/workflows/ci.yml` na `main`; do tego czasu `npm run lint && npm run build` lokalnie przed pushem                    |
| Rollback kodu bez rollbacku schematu Supabase                                     | Pre-mortem       | M          | H      | Migracje wyłącznie addytywne w trakcie MVP; przed każdą zmianą schematu zanotuj wersję workera zgodną ze schematem                           |
| Podbicie `compatibility_date` psuje polyfille `nodejs_compat` pod `@supabase/ssr` | Unknown unknowns | L          | M      | Nie ruszaj `compatibility_date` bez potrzeby; przy zmianie zweryfikuj build i logowanie lokalnie przed wdrożeniem                            |
| Nieoczekiwany binding KV `SESSION` provisionowany przez adapter                   | Unknown unknowns | M          | L      | Po pierwszym wdrożeniu sprawdź listę zasobów konta; jeśli sesje Astro nie są używane, wyłącz je w opcjach adaptera                           |
| Serwowanie `_worker.js` jako pliku statycznego z `./dist`                         | Unknown unknowns | L          | H      | Po wdrożeniu sprawdź, czy `/_worker.js/index.js` zwraca 404, a nie treść kodu                                                                |

## Getting Started

1. **Popraw nazwę workera przed pierwszym wdrożeniem.** W `wrangler.jsonc` zmień
   `"name": "10x-astro-starter"` na `"name": "team-maker"`. Po pierwszym deployu zmiana nazwy tworzy
   nowego workera zamiast przenieść istniejącego.
2. **Zaloguj się i ustaw sekrety produkcyjne** (`wrangler` jest w devDependencies, więc przez `npx`):
   ```bash
   npx wrangler login
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```
3. **Skonfiguruj środowisko lokalne.** Utwórz `.dev.vars` (nie `.env`) z tymi samymi dwoma kluczami
   i upewnij się, że plik jest w `.gitignore`. W Astro 6 `npm run dev` uruchamia już prawdziwy runtime
   `workerd` przez plugin Vite Cloudflare — **nie używaj `wrangler dev` ani `wrangler pages dev`**.
4. **Zbuduj i wdróż.** Na świeżym klonie najpierw `npx astro sync`, potem:
   ```bash
   npm run lint && npm run build
   npx wrangler deploy
   ```
   Komendą jest `wrangler deploy`, nie `wrangler pages deploy` — adapter Astro 6 nie obsługuje Pages.
5. **Zweryfikuj wdrożenie.** `npx wrangler tail` w jednym terminalu, w przeglądarce pełna ścieżka:
   rejestracja → logowanie → zapis drużyny → wylogowanie. Sprawdź też, czy `/_worker.js/index.js`
   zwraca 404. Historia i odwrót: `npx wrangler deployments list`, `npx wrangler rollback [VERSION_ID]`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
