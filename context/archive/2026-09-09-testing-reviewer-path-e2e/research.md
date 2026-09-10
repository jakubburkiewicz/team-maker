---
date: 2026-09-09T17:38:21+02:00
researcher: jakubburkiewicz
git_commit: a1941796e577e715b1599c60a686acc541f4135c
branch: main
repository: team-maker
topic: "Ryzyko #4 — gdzie przebiega granica między automatem a ręcznym dymem na torze rejestracja → potwierdzenie adresu → logowanie, i czy da się ją przesunąć bez łamania twardych reguł"
tags: [research, codebase, e2e, playwright, supabase-auth, mailpit, gotrue, ci, faza-4]
status: complete
last_updated: 2026-09-09
last_updated_by: jakubburkiewicz
---

# Research: Granica automatu i ręcznego dymu dla ryzyka #4 (test-plan, faza 4)

**Date**: 2026-09-09T17:38:21+02:00
**Researcher**: jakubburkiewicz
**Git Commit**: `a1941796e577e715b1599c60a686acc541f4135c`
**Branch**: `main`
**Repository**: team-maker

## Research Question

Gdzie przebiega granica między tym, co w ryzyku #4 pokrywa automat, a tym, co musi zostać
ręcznym dymem przeciwko produkcji — i czy tę granicę da się przesunąć bez łamania twardych
reguł. Sześć pytań szczegółowych: (1) czy lokalny stos wykonuje tor potwierdzania i czy
istnieje droga jego wywołania bez zmiany `supabase/config.toml`; (2) czym jest łapacz poczty
i jakie ma API; (3) co zostaje nieautomatyzowalne i jaki jest najtańszy egzekwowalny kształt
dymu; (4) jak e2e miałoby spełnić bramkę „CI on PR" z §5; (5) jaka jest sankcjonowana droga
uruchomienia aplikacji przeciwko lokalnemu stosowi i czy `playwright.config.ts` ma dostać
`webServer`; (6) czy wzorzec kontroli mutacyjnej z §6.2 przenosi się na e2e.

Obowiązywała zasada przekrojowa z §1: ustalenie nie liczy się, dopóki nie zostało ugruntowane
wykonaniem. Wszystkie ustalenia oznaczone **[sonda]** pochodzą z przebiegu przeciwko lokalnemu
stosowi w tej sesji; ustalenia bez tego znacznika pochodzą z lektury kodu i są tak oznaczone.
Przeciwko projektowi hostowanemu nie uruchomiono niczego. Drzewo robocze zostało zostawione
czyste, `.env` nietknięty, konta sondy i skrzynka Mailpita wyczyszczone.

## Summary

**Granicę da się przesunąć znacznie dalej, niż zakłada dziś `e2e/seed.spec.ts`, i to bez
poprawki `AGENTS.md`** — ale przesunięcie kupuje mniej, niż się wydaje, i płaci się za nie
backdoorem do bazy.

Pięć ustaleń, które rozstrzygają zadanie:

1. **Lokalny stos nie wykonuje toru potwierdzania.** `GOTRUE_MAILER_AUTOCONFIRM=true` jest
   wpieczony w env kontenera auth. `signUp` oddaje **od razu pełną sesję**, `email_confirmed_at`
   jest już ustawione, a Mailpit dostaje **zero listów**. Przez trasę aplikacji: `POST
   /api/auth/signup` → 302 `/auth/confirm-email` i **dwa ciasteczka `sb-`**, czyli lokalnie
   rejestracja **loguje** — dokładnie odwrotnie niż w produkcji. **[sonda]**

2. **Istnieje droga wywołania toru potwierdzania bez zmiany `config.toml` — cały tor przeszedł
   lokalnie.** `update auth.users set email_confirmed_at = null` (superużytkownik lokalnego
   Postgresa, **nie** `service_role`) stawia użytkownika w stanie produkcyjnym; aplikacja
   natychmiast odpowiada `?error=Email%20not%20confirmed`. Potem `POST /auth/v1/resend`
   z kluczem **anon** i parametrami PKCE wysyła prawdziwy list „Confirm your email address" do
   Mailpita, a pójście za linkiem daje `303 → http://127.0.0.1:3000?code=…` — **dokładnie kształt
   produkcyjny** z `deploy-plan.md:129-133`. Logowanie po tym przechodzi. **[sonda]**

3. **Ale to, co ten automat dowodzi, to zachowanie GoTrue, nie zachowanie aplikacji.** Stan
   „niepotwierdzony" jest **wyprodukowany zapisem do `auth.users`**, a nie wytworzony przez kod
   pod testem. Do tego link prowadzi na `site_url = http://127.0.0.1:3000` — port, na którym nic
   nie stoi — a GoTrue **milcząco ignoruje** nieznajdujący się na liście `redirect_to`
   (przesondowane: `http://localhost:4321` zostało odrzucone, list i tak niósł `:3000`). Automat
   może więc odtworzyć **wymianę tokenu**, ale nie **wylądowanie recenzenta**. **[sonda]**

4. **Bramki „e2e | CI on PR" nie da się dziś spełnić bez cofnięcia decyzji, na której stoi
   Faza 2.** Trzy zarchiwizowane miejsca zapisują „brak Dockera w CI" jako decyzję, a
   `plan-brief.md:79` Fazy 2 nazywa ją **jawnym założeniem** granicy CI/ręczne dla ryzyka #2.
   Technicznie stos w CI jest tani (repozytorium jest **publiczne**, klucz anon jest
   **deterministyczny** i nie wymaga sekretu GitHuba, `-x` odchudza obrazy z ~6,4 GB do ~2,0 GB)
   — kosztem nie są minuty, tylko ta decyzja.

5. **Kontrola mutacyjna przenosi się w rdzeniu, ale nie w koszcie**, a kanoniczną mutacją dla
   ścieżki recenzenta nie jest `listTeams` → `[]` (to złapie tańsza warstwa), tylko **zerwanie
   propagacji ciasteczka sesji** — jedyna awaria kształtu ryzyka #4, której żadna warstwa poniżej
   e2e nie widzi.

Rekomendowany kierunek dla planu: droga **(b)** z `change.md:23` — szew na potwierdzeniu — ale
z granicą przesuniętą o jeden krok w górę wobec dzisiejszego seeda i z **jawnie nazwanym
kosztem** każdego z dwóch dodatkowych członów (backdoor do `auth.users`, brak wylądowania).
Droga (a) nadal wymaga poprawki `AGENTS.md`, i to **dwóch** pól `config.toml`, nie jednego.

## Detailed Findings

### 1. Lokalny stos nie wykonuje toru potwierdzania — i to jest wpieczone w kontener

`supabase/config.toml:209` ma `enable_confirmations = false`. CLI tłumaczy to na zmienną
środowiskową kontenera auth **w momencie jego tworzenia**:

```
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SITE_URL=http://127.0.0.1:3000
GOTRUE_URI_ALLOW_LIST=https://127.0.0.1:3000
GOTRUE_RATE_LIMIT_EMAIL_SENT=360000
GOTRUE_SMTP_HOST=supabase_inbucket_10x-astro-starter
```
*(`docker inspect supabase_auth_10x-astro-starter`, kontener utworzony 2026-09-05T17:18:36)* **[sonda]**

Co zwraca `signUp` przy `false` **[sonda]** — `POST /auth/v1/signup`, HTTP 200:

| pole | wartość |
|---|---|
| `access_token`, `refresh_token` | **obecne** |
| `expires_in` | 3600 |
| `user.email_confirmed_at` | ustawione na moment rejestracji |
| `user.confirmation_sent_at` | brak |
| listy w Mailpicie | **0** |

Przez trasę aplikacji jest jeszcze wyraźniej: `POST /api/auth/signup` (z nagłówkiem `Origin` —
`security.checkOrigin` jest aktywne, `deploy-plan.md:209-212`) zwraca 302 na
`/auth/confirm-email` i ustawia **dwa ciasteczka `sb-`**. Lokalnie rejestracja **loguje**.
W produkcji nie loguje — i to jest cała treść ryzyka #4. **[sonda]**

**Czego nie przesondowano:** dokładnego kształtu odpowiedzi `signUp` przy `enable_confirmations
= true`. Wymagałoby to odtworzenia kontenera auth, czyli zmiany `config.toml` — wykluczonej
w zakresie. Ugruntowano natomiast **drugą połowę** tego zachowania: użytkownik z
`email_confirmed_at IS NULL` dostaje z `POST /auth/v1/token?grant_type=password`
**HTTP 400, `error_code: email_not_confirmed`, `msg: "Email not confirmed"`** — i to **mimo**
`AUTOCONFIRM=true`. Flaga rządzi wyłącznie tym, czy rejestracja od razu potwierdza; nie wyłącza
sprawdzenia przy logowaniu. **[sonda]**

**Czy przełączenie flagi wymaga restartu stosu: tak, pełnego cyklu.** Env kontenera jest
niezmienialny po utworzeniu (Docker), a `npx supabase start` na działającym stosie **nie
odtwarza kontenerów** — po jego uruchomieniu `Created` kontenera auth pozostało
`2026-09-05T17:18:36`. Potrzebne jest `supabase stop` + `supabase start`. **[sonda]**

**Co jeszcze psuje przełączenie flagi** — trzy rzeczy, z których druga jest najpoważniejsza:

- Każde lokalne założenie konta (ręczne i w każdym przepisie, w tym nagłówku `seed.spec.ts:36-43`)
  dostaje dodatkowy krok przez Mailpita.
- **Link i tak nie doprowadzi do aplikacji.** `site_url` to `http://127.0.0.1:3000`, lista
  dozwolonych przekierowań to `["https://127.0.0.1:3000"]`, a aplikacja stoi na `:4321`.
  Przesondowano, że klient **nie może** tego nadpisać: `POST /auth/v1/otp` z
  `redirect_to: "http://localhost:4321"` przeszedł (HTTP 200), ale list niósł
  `redirect_to=http://127.0.0.1:3000`. Domknięcie pętli w przeglądarce wymagałoby więc poprawki
  **drugiego i trzeciego** pola `config.toml` — `site_url` i `additional_redirect_urls` — czyli
  dokładnie tych dwóch, które zakaz `supabase config push` nazywa najgroźniejszymi
  (`AGENTS.md:14`, `deploy-plan.md:135-139`). **[sonda]**
- Limit `email_sent = 2` z `config.toml:182` **nie obowiązuje lokalnie** — CLI nadpisuje go na
  `GOTRUE_RATE_LIMIT_EMAIL_SENT=360000`. Sześć listów pod rząd przeszło bez odmowy. Limit, na
  którym padł odrzucony `registration-does-not-sign-in.spec.ts` (`change.md:26`), jest
  właściwością **projektu hostowanego**, nie lokalnego stosu. **[sonda]**

### 2. Tor potwierdzania **daje się** wywołać bez zmiany `config.toml` — przeszedł w całości

Pełna sekwencja, wykonana przeciwko lokalnemu stosowi z aplikacją na `:4321`: **[sonda]**

| # | krok | czym | wynik |
|---|---|---|---|
| 1 | rejestracja | `POST /api/auth/signup` (trasa aplikacji) | 302 → `/auth/confirm-email`, użytkownik **potwierdzony**, 0 listów |
| 2 | wymuszenie stanu produkcyjnego | `update auth.users set email_confirmed_at = null` przez `postgres:postgres@127.0.0.1:54322` | użytkownik niepotwierdzony |
| 3 | logowanie przez aplikację | `POST /api/auth/signin` | 302 → `/auth/signin?error=Email%20not%20confirmed` |
| 4 | wywołanie listu | `POST /auth/v1/resend` `{type:"signup", code_challenge, code_challenge_method:"s256"}`, klucz **anon** | HTTP 200, list „Confirm your email address" w Mailpicie |
| 5 | kliknięcie linku | `GET /auth/v1/verify?token=…&type=signup&redirect_to=…` | **303 → `http://127.0.0.1:3000?code=…`** |
| 6 | logowanie przez aplikację | `POST /api/auth/signin` | 302 → `/` |
| 7 | wylądowanie z `?code=` | `GET /?code=fake-code` | **302 → `/auth/signin`** — aplikacja ignoruje `code` |

Trzy rzeczy, które ta sekwencja rozstrzyga:

- **Klucz `service_role` nie jest potrzebny.** Kroki 4–6 idą na kluczu **anon** i na HTTP
  Mailpita. Jedynym uprzywilejowanym elementem jest krok 2.
- **PKCE jest tym, co kupuje wierność produkcji.** Bez `code_challenge` ten sam link oddaje
  `303 → …#access_token=…` (przepływ implicit). Z `code_challenge` oddaje `?code=…`, czyli
  dokładnie to, co `deploy-plan.md:129-133` zapisał z produkcji (`GET /?code=REDACTED`). **[sonda]**
- **Krok 7 potwierdza wykonaniem to, co dotąd było tylko notatką z produkcji:** kliknięcie
  linku **nie loguje**, bo aplikacja nie wymienia kodu. Repozytorium nie zawiera ani jednego
  wywołania `exchangeCodeForSession`, `verifyOtp`, `getSessionFromUrl` ani odczytu `token_hash`;
  `src/pages/index.astro:29` czyta wyłącznie `deleted`. Middleware odbija niezalogowanego na
  `/auth/signin`.

**Czym się za to płaci — dwa koszty, obie do jawnego zapisania w planie:**

1. **Krok 2 jest backdoorem.** Wymaga poświadczeń superużytkownika lokalnego Postgresa (CLI je
   drukuje; nie mają odpowiednika w produkcji) i **wytwarza** stan „niepotwierdzony" zapisem do
   `auth.users`, zamiast dostać go z kodu pod testem. Test zbudowany na kroku 2 asercjonuje
   zachowanie GoTrue i przekazywanie komunikatu przez `ServerError.tsx:8-15`, a **nie** to, że
   rejestracja w produkcji nie loguje.
2. **Kroku 5 nie da się wykonać w przeglądarce.** `redirect_to` prowadzi na `:3000`, gdzie nic
   nie nasłuchuje — `page.goto(link)` padłoby na odmowie połączenia. Link można pociągnąć
   wyłącznie przez `request` (albo z `maxRedirects: 0`). Automat pokryje więc **wymianę tokenu**,
   ale **nie wylądowanie recenzenta** — a to wylądowanie jest tym, co ryzyko #4 nazywa
   („ocenia produkt, do którego nie wszedł").

### 3. Mailpit — API i brak nowych zależności

Adres: `http://127.0.0.1:54324`. `supabase status -o env` wystawia zarówno `MAILPIT_URL`, jak
i historyczne `INBUCKET_URL` na ten sam adres; kontener nadal nazywa się `supabase_inbucket_*`.

Cztery wywołania, których potrzebowałby osprzęt testu — **wszystkie przesondowane zielonym
przebiegiem Playwrighta** (plik sondy uruchomiony z `e2e/`, następnie usunięty; drzewo czyste): **[sonda]**

| wywołanie | zwraca |
|---|---|
| `GET /api/v1/messages?limit=N` | `{total, unread, count, messages_count, start, tags, messages[]}` |
| `GET /api/v1/search?query=to:<adres>` (także `subject:`) | ta sama koperta, przefiltrowana |
| `GET /api/v1/message/<ID>` | `{ID, MessageID, From, To, Subject, Date, Text, HTML, Attachments, …}` — link stoi w `Text` i w `HTML` |
| `DELETE /api/v1/messages` | 200; czyści skrzynkę (sprzątanie osprzętu) |

**Zależności nie trzeba dodawać żadnej.** Wbudowany fixture `request` (`APIRequestContext`)
z `@playwright/test` sięga tam bez pośrednika; globalne `fetch` Node 22 również. Obie drogi
przeszły w tym samym teście. Link wyłuskuje się z `message.Text` zwykłym regexem — Mailpit
oddaje wersję tekstową listu, więc nie trzeba parsera HTML.

Kształt linku: `http://127.0.0.1:54321/auth/v1/verify?token=<56 hex>&type=signup&redirect_to=http://127.0.0.1:3000`.

### 4. Co zostaje nieautomatyzowalne — i najtańszy egzekwowalny kształt dymu

Po ustaleniach 1–3 poza zasięgiem **jakiegokolwiek** automatu w tym repozytorium zostaje pięć
rzeczy. Trzy pierwsze są nieusuwalne, dwie ostatnie są usuwalne, ale drożej niż warte:

1. **Dostarczalność listu.** Świadomie przyjęte ryzyko PRD FR-001, jawnie wyłączone
   w `test-plan.md:262-264`. Dym obserwuje ją mimochodem, nie testuje.
2. **Konfiguracja `site_url` i listy przekierowań w projekcie hostowanym.** Mieszka w panelu
   Supabase, poza repozytorium; `config push` jest zakazany. Błędna wartość zrywa wylądowanie
   recenzenta i **żaden plik w repozytorium tego nie widzi**. Lokalna sonda pokazała, jak łatwo
   ta wartość rozjeżdża się z portem aplikacji (`:3000` vs `:4321`).
3. **Produkcyjna kopia ekranu `/auth/confirm-email`.** `confirm-email.astro:4-18` rozgałęzia
   treść na `import.meta.env.DEV`. Przesondowane pod `npm run dev`: renderuje się **„Registration
   successful" / „Your account has been created. You can now sign in."**. Produkcja renderuje
   **„Check your email" / „We've sent a confirmation link…"**. E2E puszczone przeciwko `npm run
   dev` asercjonowałoby więc tekst, którego produkcja **nigdy nie pokazuje**. **[sonda]**
4. **To, że rejestracja w produkcji zostawia recenzenta wylogowanym.** Lokalnie zostawia go
   **zalogowanym** (dwa ciasteczka `sb-`). Odtworzyć to można tylko backdoorem z ustalenia 2 —
   a wtedy asercjonuje się GoTrue, nie aplikację.
5. **Treść szablonów listów** projektu hostowanego.

**Najtańszy kształt dymu, który jest egzekwowalny, a nie zdaniem w planie.** Repozytorium ma już
dwa precedensy właściwego kształtu i oba są lepsze niż lista w prozie:

- `scripts/probe-save-barrier.sh` — kryterium **ręczne**, ale **wykonywalne**, z odwróconym kodem
  wyjścia i odmową startu na brudnym drzewie. Uruchomienie jest tańsze niż założenie
  (`context/archive/2026-09-07-testing-save-barrier/plan-brief.md:37`).
- `deploy-plan.md` §3 i §5 — tabele dymu z werdyktem na wiersz, plus „Ręczne przejście przez
  przeglądarkę" z wklejonym logiem `wrangler tail`. **To właśnie ten dym wykrył rozjazd
  potwierdzania w ogóle** (`deploy-plan.md:119-139`), czyli ryzyko #4 istnieje dlatego, że ktoś
  ten dym wykonał.

Kształt, który łączy oba i kosztuje najmniej: skrypt, który **sam wykonuje część bezmailową**
przeciwko produkcji (`GET /` → 302, `GET /auth/signin` → 200, `POST /api/auth/signin`
z fałszywymi danymi → `?error=…` — trzy sondy już wykonane w `deploy-plan.md` §5), **wypisuje
dwa kroki, których nie umie zrobić** (otwórz list, kliknij link, potwierdź wylądowanie) i
**odmawia zakończenia zerem**, dopóki człowiek nie odda mu z powrotem adresu, na który wylądował.
Wtedy „dym wykonany" jest stanem obserwowalnym, a nie deklaracją.

**Dwa koszty, które taki dym musi ponieść jawnie:**

- Każdy przebieg **zakłada trwałe konto w produkcyjnej bazie**. Pozycja „Konto testowe
  w produkcyjnej bazie — do usunięcia przed oddaniem projektu" stoi otwarta w
  `deploy-plan.md:234-235` i od tamtej pory **urosła**: zmiana `2026-09-06-cross-account-team-isolation`
  wykonała na produkcji macierz dwóch kont, zostawiając konto A z zapisaną drużyną, i żaden
  z tych planów nie miał kryterium sprzątania. Dym musi albo sam usuwać konto, albo dług
  przyjąć na piśmie. To jest ten sam koszt, przez który odrzucono
  `e2e/registration-does-not-sign-in.spec.ts` (`change.md:26`).
- Częstotliwość. §5 mówi „między scaleniem a produkcją | recommended". Przy personie, która
  wchodzi **raz**, uczciwą kadencją jest „przed oddaniem projektu recenzentowi", a nie „przy
  każdym scaleniu" — inaczej pozycja z poprzedniego punktu rośnie liniowo.

### 5. Bramka „e2e | CI on PR" — co konkretnie kosztuje każdy wariant

Stan zastany: `.github/workflows/ci.yml` to pięć kroków (`astro sync`, `lint`, `test`, `build`),
sekrety przypięte wyłącznie do `npm run build`, zero `services:`, zero Dockera.

#### Wariant A — stos Supabase w CI

Co **przemawia za** (wszystko przesondowane): **[sonda]**

- **Repozytorium jest publiczne** (`gh repo view` → `PUBLIC`), więc runnery GitHuba są darmowe,
  a Docker jest na `ubuntu-latest` preinstalowany.
- **Klucz anon nie wymaga sekretu GitHuba.** Ładunek to `{"iss":"supabase-demo","role":"anon","exp":1983812996}`,
  podpisany sekretem JWT, który **leży w repozytorium** (`supabase/config.toml`). Jest
  deterministyczny między maszynami i można go wpisać wprost do workflow.
- **Obrazy da się odchudzić.** CLI v2.98.2 przyjmuje `-x` z listą
  `gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
  Potrzebne są tylko: postgres (1,3 GB), postgrest (438 MB), kong (149 MB), gotrue (58 MB),
  mailpit (29 MB) — **≈ 2,0 GB** zamiast ≈ 6,4 GB pełnego zestawu (studio 1,13 GB,
  storage 807 MB, edge-runtime 686 MB, logflare 605 MB, realtime 464 MB, pg-meta 376 MB,
  imgproxy 162 MB, vector 137 MB są zbędne).

Co **kosztuje**:

- Nowe kroki: `supabase start -x …`, zastosowanie migracji, zapis pliku z sekretami, start
  aplikacji, `npx playwright install --with-deps chromium`, `npx playwright test`.
- **Start aplikacji jest ostrym brzegiem.** Zmienne wstrzyknięte inline w powłoce **nie dotrą**
  do workera: `includeProcessEnv` jest fałszem, dopóki `wrangler.jsonc` nie ma klucza `secrets`
  albo nie ustawi się `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`. CI musi **zapisać plik**
  (`.env` albo `.dev.vars`). *(ustalenie z lektury `node_modules/wrangler/wrangler-dist/cli.js`, nie z przebiegu w CI)*
- **`npm run preview` wymagałoby drugiego builda.** Build **wypieka** `dist/server/.dev.vars`,
  więc build z sekretami produkcyjnymi (dzisiejsza bramka) daje artefakt wskazujący projekt
  hostowany. E2E przez preview potrzebowałoby builda z wartościami lokalnymi — czyli dwóch
  buildów albo przestawienia kolejności bramek.
- **Koszt właściwy nie jest w minutach.** „Brak Dockera w CI" jest zapisany jako **decyzja**
  w trzech zarchiwizowanych miejscach
  (`context/archive/2026-09-07-testing-save-barrier/research.md:243-247`, `plan.md:113-114`,
  `plan.md:98-99`), a `context/archive/2026-09-07-test-plan-refresh/plan-brief.md:79` nazywa ją
  **jawnym założeniem**, na którym stoi granica CI/ręczne ryzyka #2. Postawienie stosu w CI
  **unieważnia to założenie** i otwiera z powrotem rozstrzygnięcie Fazy 2 — której dym RLS jest
  ręczny właśnie dlatego, że CI nie ma Postgresa. Faza 4 nie może tego przesądzić po cichu
  „przy okazji"; to jest zmiana zakresu Fazy 2.

#### Wariant B — dedykowany projekt hostowany

W `context/` **nie ma śladu** rozważania drugiego projektu; istnieje jeden hostowany
(`ifytodkdnzgsflptiyfx`, `deploy-plan.md:141-145`) plus stos lokalny. Koszty:

- Drugi projekt Supabase, jego konfiguracja `site_url`/przekierowań w panelu, `db push` przy
  każdej zmianie schematu, sekrety w GitHubie.
- **Potwierdzanie byłoby tam włączone** (domyślne), a Mailpita nie ma. Automat musiałby albo
  czytać skrzynkę zewnętrzną, albo sięgnąć po `generateLink` na kluczu **`service_role`** —
  a ten klucz jest w tym repozytorium konsekwentnie traktowany jako zagrożenie dla modelu
  izolacji, nigdy jako narzędzie testowe
  (`context/archive/2026-09-06-own-teams-list-and-detail/reviews/impl-review.md:172-180`).
- Każdy przebieg mnożyłby trwałe konta — awaria, przez którą odrzucono
  `registration-does-not-sign-in.spec.ts`.
- Wróciłby też limit `email_sent`, tym razem realny (lokalnie jest nadpisany na 360000).

**Wniosek dla planu:** wariant B kosztuje więcej i kupuje mniej. Wariant A jest technicznie
tani, ale wydaje decyzję, na której stoi Faza 2. Trzecia możliwość, której brzmienie §5
dopuszcza: **przesunąć bramkę** z „CI on PR" na „local + przed oddaniem", i zapisać to jako
świadome osłabienie, a nie przeoczenie. Badanie nazywa te trzy drogi; wybór należy do planu.

### 6. Sankcjonowana droga uruchomienia i pytanie o `webServer`

**Litera reguły** — `AGENTS.md:13`, dosłownie:

> Local dev is `npm run dev` — Astro 6 runs the real `workerd` runtime through the Cloudflare
> Vite plugin. Do not use `wrangler dev`. Local secrets live in `.env` (gitignored; wrangler 4.90
> loads it the same way it loads `.dev.vars`), production secrets in `npx wrangler secret put <NAME>`.

**Mechanika, która to komplikuje: `.dev.vars` nie stoi *obok* `.env` — on go *wyłącza*.**
`getVarsForDev` (`node_modules/wrangler/wrangler-dist/cli.js:297455`) czyta `.env` **wyłącznie
gdy `.dev.vars` nie istnieje**; scalania nie ma. Potwierdzone przebiegiem: po utworzeniu
tymczasowego `.dev.vars` dev wypisał `Using secrets defined in .dev.vars` i wstał na lokalnym
stosie w ~5 s. **[sonda]**

Konsekwencja dla `change.md:16`: przebieg seeda przez osobny `.dev.vars` **nie** postawił drugiego
pliku obok `.env` — **odciął `.env`**. To działało, ale nie jest drogą sankcjonowaną. Drogą
zgodną z `AGENTS.md:13` jest **przestawienie zawartości `.env`** na `SUPABASE_URL=http://127.0.0.1:54321`
i klucz anon ze stosu. Przełącznik jest dokładnie jeden i jest nim zawartość `.env`; nadpisania
inline z powłoki nie działają (patrz §5).

Sonda działania aplikacji na lokalnym stosie **[sonda]**: `GET /` → 302 `/auth/signin`;
`GET /auth/confirm-email` → 200 z **deweloperską** kopią; `POST /api/auth/signup` → 302
`/auth/confirm-email`; `POST /api/auth/signin` → 302 z `?error=` albo na `/`. Aplikacja działa
na lokalnym stosie bez żadnej zmiany w kodzie.

**Czy `playwright.config.ts` ma dostać `webServer`?** Badanie nie rozstrzyga za plan, ale
przenosi pytanie w inne miejsce, bo obie odpowiedzi mają wadę:

- `webServer: { command: "npm run dev" }` — wstaje w ~5 s, czyta `.env` na żywo, nie wymaga
  builda. Ale `import.meta.env.DEV` jest prawdą, więc `/auth/confirm-email` renderuje kopię,
  której produkcja nie ma (§4 pkt 3) — każda asercja na tym ekranie byłaby fałszywym dowodem.
- `webServer: { command: "npm run preview" }` — wzorzec z `test-plan.md:113`, renderuje kopię
  produkcyjną, `astro preview` jest pod tym adapterem wspierane. Ale wymaga wcześniejszego
  `npm run build`, a build **zamraża** stos w `dist/server/.dev.vars` — przełączenie stosu
  wymaga przebudowy. W drzewie leży już taki plik z builda 2026-09-07, wskazujący projekt
  **hostowany**.

**Właściwe pytanie jest inne.** `playwright.config.ts:9-14` uzasadnia brak `webServer` obawą, że
testy pójdą w projekt hostowany. `webServer` sam w sobie tej obawy **nie usuwa i nie pogłębia**
— pogłębia ją to, że przy `webServer` nikt już świadomie nie wybiera stosu. Tym, co obawę
usuwa, jest **strażnik, który odmawia startu, gdy `SUPABASE_URL` nie jest stosem lokalnym**.
Plan powinien rozstrzygać ten strażnik, a `webServer` dopiero po nim.

### 7. Kontrola mutacyjna na warstwie e2e

**Co się przenosi z §6.2 bez zmian:** wersjonowana łatka zamiast `sed` (recenzowalna,
`git apply -R` cofa dokładnie, przy refaktorze przestaje się nakładać **głośno**), zdejmowanie
w `trap` na `EXIT/INT/TERM` ustawionym **przed** pierwszą modyfikacją, odmowa startu na brudnym
drzewie, i **odwrócony kod wyjścia**. Nic z tego nie jest związane z Vitestem. Przenosi się też
powód, dla którego sonda nie idzie do CI: „łatanie plików źródłowych na runnerze to nowa klasa
awarii zielonego builda" (`context/archive/2026-09-07-testing-save-barrier/plan.md:115-116`).

**Czego się nie przenosi — i to jest istota różnicy:** sonda §6.2 jest hermetyczna i trwa
sekundy (`npm test`, zero stanu zewnętrznego). Sonda e2e wymaga dodatkowo: stojącego stosu,
`.env` wskazującego ten stos, procesu aplikacji, potwierdzonego konta testowego i przeglądarki.
Każdy z tych warunków to **osobna droga do czerwieni z powodu innego niż mutacja** — czyli do
fałszywego „strażnik wiąże". §6.2 nie ma tej klasy awarii. Sonda e2e musi więc odróżniać
„czerwone od mutacji" od „czerwone od osprzętu", co znaczy **trzy przebiegi zamiast jednego**:
zielony przed łatką, czerwony na łatce, zielony po jej zdjęciu. Bez pierwszego i trzeciego
odwrócony kod wyjścia kłamie.

*(Poboczne, do zweryfikowania w planie: `npm run dev` wypisuje `watching for file changes...`,
więc łatka na `src/` powinna zostać podjęta bez restartu serwera. Nie przesondowano dla
konkretnej łatki.)*

**Kanoniczna mutacja dla ścieżki recenzenta.** Kryterium wyboru narzuca §1 zasada #1: mutacja ma
trafiać w awarię, której **żadna tańsza warstwa nie widzi** — inaczej sonda dowodzi, że wiąże
Vitest, a nie e2e. Trzy kandydatki:

| kandydatka | co robi | werdykt |
|---|---|---|
| `listTeams` → `[]` | lista drużyn pusta mimo zapisu | Użyta doraźnie przy sondowaniu seeda (`change.md:15`). Ale to moduł danych, który zwiąże też Faza 2 na tańszej warstwie — jako **kanoniczna słaba** |
| **zerwanie propagacji ciasteczka sesji** (adapter `cookies` w `src/lib/supabase.ts`) | logowanie „udaje się" (302 → `/`), middleware nie widzi użytkownika i odbija z powrotem na `/auth/signin`; recenzent nie wchodzi | **Najmocniejsza.** Dokładnie kształt ryzyka #4, niewidoczna dla każdej warstwy poniżej e2e — żaden test trasy nie prowadzi prawdziwego słoika ciasteczek przez dwa żądania. Jedyną rzeczą, która kiedykolwiek to sprawdziła, jest ręczne przejście z `deploy-plan.md:94-118` |
| `getUser()` → `getSession()` w middleware | bariera ufa niezweryfikowanemu JWT | Teren ryzyka #2/#3, czyli Faza 2. Poza zakresem |

Rekomendacja: **kanoniczną mutacją jest zerwanie propagacji ciasteczka sesji**, bo to jedyna
z trzech, która uzasadnia cenę warstwy e2e. Napisanie łatki należy do planu.

## Code References

- `supabase/config.toml:209` — `enable_confirmations = false`; `:154`, `:156` — `site_url` i `additional_redirect_urls` na `127.0.0.1:3000`; `:182` — `email_sent = 2` (lokalnie nadpisany na 360000)
- `src/pages/api/auth/signup.ts:13` — `signUp({email, password})` **bez `options`**, więc bez `emailRedirectTo`; `:19` — 302 na `/auth/confirm-email`; `:16` — `?error=<encodeURIComponent(message)>`
- `src/pages/auth/confirm-email.astro:4-18` — rozgałęzienie kopii na `import.meta.env.DEV`; `:9-11` kopia deweloperska, `:15-17` produkcyjna
- `src/pages/index.astro:29` — jedyny czytany parametr to `deleted`; `?code=` ignorowane
- `src/middleware.ts:9-21` — `getUser()`, odbicie niezalogowanego na `/auth/signin`; `src/lib/routes.ts:16,22` — `/` dokładne, `/teams` i `/api/teams` prefiksowe
- `src/components/auth/ServerError.tsx:8-15` — komunikat Supabase renderowany dosłownie, bez `role="alert"`
- `src/components/auth/SignUpForm.tsx:67-131` — nazwy dostępne: `Email`, `Password`, `Confirm password`, przycisk `Create account`
- `e2e/seed.spec.ts:28-34` — dzisiejsza deklaracja granicy automatu; `:36-43` — przepis uruchomienia; `:82-89` — `openFromIsland`
- `playwright.config.ts:9-14` — uzasadnienie braku `webServer`; `:26` — `baseURL` z `E2E_BASE_URL`
- `scripts/probe-save-barrier.sh:44-79` — odmowa startu na brudnym drzewie, `trap`, odwrócony kod wyjścia
- `.github/workflows/ci.yml:14-25` — pięć kroków, sekrety tylko na `build`
- `node_modules/wrangler/wrangler-dist/cli.js:297455` — `getVarsForDev`: `.env` czytane wyłącznie, gdy brak `.dev.vars`

## Architecture Insights

- **Rozjazd potwierdzania nie jest jedynym rozjazdem lokalne/produkcja na tym torze — jest
  trzecim.** Pierwszy to `enable_confirmations`. Drugi to `site_url` (`:3000` lokalnie, workers.dev
  w produkcji), przez co lokalny link nie może wylądować w aplikacji. Trzeci to
  `import.meta.env.DEV` w `confirm-email.astro`, przez co ekran potwierdzenia ma **dwie różne
  treści**. `AGENTS.md` nazywa tylko pierwszy. Drugi i trzeci są równie skuteczne w unieważnianiu
  automatu i nie są nigdzie zapisane.
- **Aplikacja nie ma szwu między „rejestracja wysłana" a „logowanie się udało".** Brak
  `exchangeCodeForSession`, brak trasy `/auth/callback`, brak odczytu `code`. Ten fragment
  ryzyka #4 nie ma w kodzie miejsca, w które można by wbić asercję — jest własnością konfiguracji
  Supabase, nie repozytorium. To jest strukturalny powód, dla którego dym ręczny nie jest tu
  wygodą, tylko koniecznością.
- **Klucz anon lokalnego stosu jest deterministyczny i publiczny** (`iss: supabase-demo`, sekret
  JWT w repozytorium). Znosi to cały argument „e2e w CI wymaga sekretów" dla wariantu lokalnego —
  ale nie znosi argumentu o Dockerze.
- **Powtarza się wzorzec z `lessons.md`: zielony strażnik na rozbrojonym stanie.** Automat
  potwierdzania zbudowany na backdoorze do `auth.users` byłby dokładnie tym — zielony, wiążący
  GoTrue, ślepy na aplikację. Rozpoznanie tego przed napisaniem testu jest właściwym wynikiem
  tego badania.

## Historical Context (from prior changes)

- `context/archive/2026-09-07-testing-save-barrier/research.md:243-247` — „Prawdziwy Postgres jest
  poza zasięgiem CI… `ci.yml` woła gołe `npm test` bez `env:`, bez `services:`, bez Dockera".
  Kanoniczne sformułowanie decyzji, którą wariant A z §5 unieważnia.
- `context/archive/2026-09-07-testing-save-barrier/plan.md:131-157` — zamrożony hunk łatki i
  odrzucenie `sed` z trzema powodami; `:115-116` — dlaczego sonda nie idzie do CI.
- `context/archive/2026-09-07-testing-save-barrier/reviews/plan-review.md:29-49` — F1 (CRITICAL),
  która wymusiła wersjonowaną łatkę zamiast mutacji opisanej prozą. Ta sama klasa uwagi grozi
  Fazie 4, jeśli kontrola mutacyjna zostanie zapisana słowami.
- `context/archive/2026-09-07-test-plan-refresh/plan-brief.md:79` — „Granica CI/ręczne dla ryzyka
  #2 opiera się na założeniu, że `ci.yml` nie dostanie `services:`". **Bezpośrednia zależność
  Fazy 2 od rozstrzygnięcia Fazy 4.**
- `context/deployment/deploy-plan.md:94-139` — ręczne przejście przez przeglądarkę z logiem
  `wrangler tail`, które **wykryło** rozjazd potwierdzania i doprowadziło do zmiany decyzji PRD
  FR-001. Wzorzec dymu do skopiowania.
- `context/deployment/deploy-plan.md:234-235` — otwarta pozycja „Konto testowe w produkcyjnej
  bazie". Nigdzie w `context/` ani w historii git nie ma śladu jej domknięcia; populacja kont
  produkcyjnych od tego czasu urosła (`context/archive/2026-09-06-cross-account-team-isolation/plan.md:370,435`).
- `context/changes/testing-reviewer-path-e2e/change.md:26` — odrzucony
  `e2e/registration-does-not-sign-in.spec.ts`; powody odrzucenia (trwałe konta, realne listy,
  limit SMTP) są **właściwościami projektu hostowanego**, a nie stosu lokalnego — co §1 tego
  badania rozstrzyga sondą.

## Related Research

- `context/archive/2026-09-07-testing-save-barrier/research.md` — badanie Fazy 1; źródło wzorca
  §6.2 i rozstrzygnięcia reguły czystości testów.
- `context/archive/2026-09-07-test-plan-refresh/plan-brief.md` — przepisanie granicy CI/ręczne
  po zmianie reguły czystości; zawiera założenie, które Faza 4 może unieważnić.

## Open Questions

1. **Czy Faza 4 ma prawo unieważnić założenie Fazy 2 o braku Dockera w CI?** To nie jest pytanie
   techniczne — technicznie wariant A jest tani. To pytanie o zakres: Faza 2 ma status
   `not started`, a jej granica CI/ręczne jest już zapisana. Rozstrzygnięcie należy do planu
   Fazy 4 albo do wspólnej decyzji obu faz.
2. **Czy automat potwierdzania oparty na backdoorze do `auth.users` przechodzi próbę §1
   zasady #1?** Kupuje jeden dodatkowy człon ścieżki, ale asercjonuje GoTrue, nie aplikację,
   i nie pokrywa wylądowania. Badanie skłania się do „nie", ale to jest rozstrzygnięcie
   kosztu × sygnału, czyli decyzja planu.
3. **Kształt strażnika „nie uruchamiaj przeciwko produkcji".** Bez niego `webServer` jest
   ryzykiem, z nim — wygodą. Gdzie ma mieszkać: w `playwright.config.ts` (`globalSetup`), czy
   w samym `webServer.command`?
4. **Czy `npm run dev` podejmuje łatkę bez restartu** — potrzebne dla kształtu sondy mutacyjnej
   e2e; nieprzesondowane.
5. **Kadencja i własność dymu produkcyjnego** — „przed oddaniem projektu" czy „przy każdym
   scaleniu", i kto usuwa konto testowe. Wiąże się z otwartą pozycją `deploy-plan.md:234-235`.
6. **Poboczne, poza zakresem tej zmiany:** `.env.local` nie jest w `.gitignore`, choć wrangler
   go ładuje i **nadpisuje** nim `.env` (`cli.js:167237-167245`). Commitowalny plik przesłaniający
   sekrety lokalne. Do osobnej zmiany.
