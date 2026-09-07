# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-07

## 1. Strategy

Testy w tym projekcie podlegają trzem zasadom nienegocjowalnym:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje prawdziwy sygnał dla danego
   ryzyka. Nie promuj do e2e dlatego, że e2e „wydaje się bezpieczniejsze". Nie nakładaj
   modelu wizyjnego na deterministyczną różnicę, która już łapie regresję.
2. **Obawy użytkownika są dowodem pierwszej kategorii.** Ryzyko zakotwiczone w „zespół
   obawia się X, a awaria ujawniłaby się gdzieś w obszarze `<obszar>`" waży tyle samo,
   co linia PRD albo dane o zmienności.
3. **Ryzyka to scenariusze, nie lokalizacje w kodzie.** Ten plan dokumentuje, *co może
   zawieść* i *dlaczego uważamy to za prawdopodobne* — na podstawie dokumentów, wywiadu
   i *sygnału* z bazy kodu (zmienność, struktura, baza testowa). **Nie** twierdzi, że wie,
   która linia jest właścicielem awarii. Tę wiedzę produkuje `/10x-research` w trakcie
   każdej fazy wdrożenia. Jeśli plan i badanie różnią się co do tego, gdzie mieszka awaria,
   **badanie jest prawdą gruntową**.

Zasada przekrojowa, wyprowadzona z `context/foundation/lessons.md` (5 z 7 wpisów opisuje tę
samą klasę): **strażnik ani asercja nie liczą się, dopóki nie wykazano, że czerwienią się na
stanie sprzed zmiany i przy wariancie rozbrajającym.** Zielony strażnik, który przechodzi na
rozbrojonej barierze, jest dekoracją. Ta zasada nie jest osobnym ryzykiem — wiąże w kolumnie
anty-wzorców każdego wiersza §2.

Zakres hot-spotów użyty do ważenia prawdopodobieństwa: `src/`, `supabase/migrations/`
(z wykluczeniem `context/`, `dist/`, `node_modules/`, `.astro/`, plików lock i dokumentacji).

## 2. Risk Map

Najważniejsze scenariusze awarii, przed którymi projekt musi się bronić, uporządkowane wedle
ryzyka = wpływ × prawdopodobieństwo. Ryzyka są scenariuszami awarii w kategoriach
użytkownika / biznesu, nie nazwami testów. Kolumna Źródło cytuje *dowód, który wyniósł to
ryzyko na wierzch* — nigdy konkretnego pliku jako „miejsca, gdzie mieszka awaria" (to jest
zadanie badania, patrz §1 zasada #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Skład niespełniający progu 2 punktów zostaje trwale zapisany, bo pilnował go przycisk, a trasa zapisu już nie — wystarczy spreparowane żądanie do własnej trasy aplikacji z ważnym ciasteczkiem sesji, bez udziału interfejsu | High | High | PRD Guardrail „Zapisana drużyna zawsze spełnia próg… reguła obowiązuje także poza interfejsem"; PRD FR-007, FR-018; interview Q1, Q4; hot-spot dir `src/pages/api/teams/` (8 commits/30d) |
| 2 | Gracz odczytuje lub zmienia drużynę innego konta przez odgadnięty identyfikator w adresie | High | Medium | PRD US-04; PRD Guardrail izolacji danych; PRD NFR binarny („liczba drużyn cudzego konta widocznych lub modyfikowalnych wynosi zero"); interview Q1, Q4; `lessons.md` §„Strażnik grepowy nad SQL-em"; hot-spot dirs `supabase/migrations/` (6 commits/30d), `src/pages/api/teams/` (8 commits/30d) |
| 3 | Niezalogowany dosięga trasy aplikacji, bo bariera przepuszcza kształt adresu, którego czyste dopasowanie ścieżki nie przewidziało | High | Medium | PRD FR-004; PRD `## Access Control` („nie ma publicznej strony powitalnej ani trybu gościa"); interview Q4; `lessons.md` §„Strażnik grepowy nad JSX/TS" (wariant z końcowym ukośnikiem wraca do martwej trasy przez normalizację) |
| 4 | Recenzent nie domyka ścieżki rejestracja → potwierdzenie adresu → logowanie i ocenia produkt, do którego nie wszedł | High | Medium | PRD `## User & Persona` (persona główna wchodzi **raz**, ma kilka minut, bez pomocy z zewnątrz); PRD FR-001 (zmiana decyzji 2026-08-30); PRD `## Access Control` („kliknięcie linku **nie loguje**"); interview Q1 |
| 5 | Wykres i werdykt progu rozjeżdżają się z faktycznym składem — gracz dostaje zielone światło dla składu, który go nie ma, albo blokadę mimo domkniętej reguły | High | High | PRD Guardrail „Wykres zawsze zgodny ze składem"; PRD FR-016, FR-018; PRD NFR < 200 ms; interview Q3; hot-spot dirs `src/components/team/` (39 commits/30d — najwyższa zmienność w repozytorium), `src/lib/domain/` (24 commits/30d) |
| 6 | Limity składu — maksimum 6 członków, maksimum 2 perki, brak powtórzeń postaci — dają się obejść żądaniem z pominięciem interfejsu | Medium | High | PRD Guardrail „Limity składu nie do obejścia"; PRD FR-012, FR-014; interview Q1, Q4; hot-spot dir `src/pages/api/teams/` (8 commits/30d) |

Kalibracja: wpływ mierzony utratą warunku certyfikacji albo złamaniem guardraila binarnego
z PRD; prawdopodobieństwo — zmiennością katalogu hot-spot × brakiem testu wykonawczego dla
tej powierzchni. Ryzyka #1 i #5 to jedyne High × High i idą pierwsze.

Soczewka nadużyć: #2 pokrywa kontrolę własności zasobu (IDOR), #1 i #6 — równoważność
walidacji po stronie serwera wobec niezaufanego żądania. Nadużycie zasobów świadomie
pominięte: limit `email_sent` konfigurowany jest w panelu Supabase, poza zasięgiem
repozytorium, więc test w repo nie pokryłby produkcji.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Żądanie zapisu ze składem poniżej progu **nie zostawia wiersza w bazie** i zwraca odmowę — niezależnie od tego, co wysłał interfejs | „Przycisk jest zablokowany, więc taki skład nigdy nie dotrze do trasy" | Punkt wejścia zapisu; czy tor zapisu woła regułę progu przed utrwaleniem; kształt odmowy | integracja / kontrakt na granicy trasy | Lustro implementacji: oczekiwana wartość przepisana z tego, co trasa dziś zwraca (problem wyroczni) — wyrocznia pochodzi z Guardraila PRD, nie z kodu pod testem. Osobno: atrapa klienta pisana ręcznie może w ciszy rozjechać się z zachowaniem prawdziwej bazy, więc zielony test na atrapie nie jest dowodem, dopóki nie wykazano czerwieni na wariancie rozbrajającym — to zastosowanie zasady przekrojowej z §1 do konkretnego przypadku atrapy |
| #2 | Konto A wykonuje odczyt, aktualizację i usunięcie na identyfikatorze konta B i **dostaje zero wierszy albo odmowę** — sprawdzone **wykonaniem, nie odczytem SQL-a**. Wykonanie ma dwa człony: bramka automatyczna wykonuje **tor żądania** dla czterech operacji (tożsamość brana z sesji, klient podmieniony atrapą), a dym lokalny wykonuje **zapytanie do prawdziwej bazy** i dowodzi samego efektu polityk RLS | „Polityka jest w migracji, więc obowiązuje"; „strażnik grepowy jest zielony, więc bariera stoi" | Realny tor żądania dla czterech operacji; czym jest tożsamość w zapytaniu; jak postawić dwa konta w teście | Dwuczłonowo. **W CI (bramka automatyczna)**: wykonanie toru żądania dla czterech operacji na atrapie klienta — dowód, że trasa zawsze zawęża zapytanie do tożsamości z sesji i nigdy nie wypuszcza wiersza cudzego konta. **Lokalnie / ręcznie**: sam efekt polityk RLS, przeciwko prawdziwej bazie z `npx supabase start`, bo `.github/workflows/ci.yml` woła gołe `npm test` — bez `services:`, bez `env:`, bez Dockera. Konsekwencja: rozbrojenie polityki RLS w migracji przejdzie w CI na zielono, więc dym ręczny nie jest tu opcjonalnym dodatkiem | Rozbudowa strażnika grepowego po SQL-u zamiast wykonania — dokładnie ta klasa, którą `lessons.md` opisuje pięciokrotnie. Osobno: atrapa klienta pisana ręcznie może w ciszy rozjechać się z zachowaniem prawdziwej bazy, więc zielony test na atrapie nie jest dowodem, dopóki nie wykazano czerwieni na wariancie rozbrajającym — to zastosowanie zasady przekrojowej z §1 do konkretnego przypadku atrapy |
| #3 | Żądanie bez sesji na trasę chronioną **kończy się przekierowaniem**, także dla wariantów zapisu adresu (końcowy ukośnik, kodowanie procentowe, wielkość liter) | „Testy dopasowania ścieżki przechodzą, więc bariera działa" — one testują funkcję, nie przepuszczenie żądania | Gdzie kończy się dopasowanie ścieżki, a zaczyna decyzja o przepuszczeniu; kształt sesji; rozjazd między listą tras chronionych a trasami faktycznie istniejącymi | integracja na poziomie żądania | Kolejny test czystej funkcji dopasowania — dubluje istniejące pokrycie i nie rusza luki |
| #4 | Po potwierdzeniu adresu gracz **wraca jako niezalogowany, przechodzi logowanie i dociera do zapisanej drużyny** — cała ścieżka persony głównej w jednym przebiegu | „Uruchomię to lokalnie, więc pokrywam produkcję" — **lokalnie potwierdzanie jest wyłączone, w produkcji włączone**; ten rozjazd jest świadomy (`AGENTS.md`) | Czy lokalny stos w ogóle wykonuje tor potwierdzania; czym jest łapacz poczty w tym stosie; **co da się pokryć automatem, a co musi zostać ręcznym dymem przeciwko środowisku produkcyjnemu** | e2e dla toru po potwierdzeniu + jawnie ręczny dym dla samego potwierdzenia | Test dostarczalności poczty — PRD **świadomie przyjmuje** to ryzyko (FR-001), więc jego testowanie kupuje zero |
| #5 | Zmiana członka albo perka przesuwa sumy kompetencji i werdykt progu **zgodnie z regułą**, a stan przycisku idzie za werdyktem **w obie strony** — także po cofnięciu wyboru | „Testy reguły domenowej przechodzą, więc wykres jest z nią zgodny" — reguła jest przetestowana, **podpięcie nie** | Gdzie stan składu spotyka się z wyliczeniem i z werdyktem; czy wyspa jest hydratowana; para (dyrektywa `client:*`, flaga trybu) jako jeden przełącznik z `lessons.md` | test komponentu w środowisku DOM, nie e2e | Snapshot pikselowy wykresu (§7) oraz asercja liczbowa skopiowana z implementacji zamiast wyprowadzona z reguły PRD |
| #6 | Żądanie z siódmym członkiem, trzecim perkiem albo powtórzoną postacią **nie zostawia wiersza** i zwraca odmowę | „Interfejs nie pozwala kliknąć siódmego, więc limit obowiązuje" | Czy limity są wyliczane w tym samym module co próg; czy tor zapisu je woła; kształt odmowy | ta sama warstwa co #1 — jeden tor, dwa zestawy przypadków | Osobna infrastruktura testowa dla limitów; przypadki brzegowe limitów wchodzą do toru zbudowanego dla #1. Osobno: atrapa klienta pisana ręcznie może w ciszy rozjechać się z zachowaniem prawdziwej bazy, więc zielony test na atrapie nie jest dowodem, dopóki nie wykazano czerwieni na wariancie rozbrajającym — to zastosowanie zasady przekrojowej z §1 do konkretnego przypadku atrapy |

## 3. Phased Rollout

Każdy wiersz to odrębna faza wdrożenia, która otworzy własny folder zmiany przez `/10x-new`.
Status przesuwa się w prawo przez wartości wymienione poniżej; orkiestrator aktualizuje Status
w miarę pojawiania się artefaktów na dysku.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bariera serwerowa zapisu drużyny | Skład łamiący próg albo limity nie zostaje utrwalony, choćby żądanie ominęło interfejs | #1, #6 | integration, contract | researched | `context/changes/2026-09-07-testing-save-barrier/` |
| 2 | Wykonywalny dowód izolacji i przepuszczania | Cudza drużyna jest niedostępna na wszystkich czterech operacjach, a bariera trasy przepuszcza wyłącznie sesję — sprawdzone wykonaniem, nie grepem; bramka CI domyka tor żądania, a sam efekt polityk RLS zostaje dymem ręcznym na lokalnym stosie | #2, #3 | integration na poziomie żądania (dwie tożsamości, atrapa klienta), jawnie ręczny dym RLS na lokalnym stosie | not started | — |
| 3 | Podpięcie wyspy: skład → wykres → werdykt | Reguła domenowa widoczna na ekranie odpowiada regule liczonej w module, w obie strony | #5 | component (DOM) | not started | — |
| 4 | Ścieżka recenzenta e2e i bramki jakości | Persona główna przechodzi rejestracja → logowanie → zapisana drużyna w jednym przebiegu, a dolna granica zostaje zamknięta w CI | #4, cross-cutting | e2e, gates, AI-native review | not started | — |

Uzasadnienie kolejności: Faza 1 domyka jedno z dwóch High × High najtańszą warstwą, jaka może
je udowodnić. Strukturalne pytanie o pogodzenie testu wykonawczego z regułą czystości testów
rozstrzygnęło się **w badaniu** Fazy 1, a nie w jej implementacji, i zostało utrwalone
w `AGENTS.md` — Faza 2 wchodzi więc już na rozstrzygniętym gruncie. Faza 2 zamienia jedyną klasę strażników,
która w tym repozytorium już raz zawiodła, na wykonanie. Faza 3 bierze najwyższą zmienność
przy zerowym pokryciu warstwą tańszą niż e2e, więc idzie przed nim. Faza 4 kupuje jedyne,
czego tańsze warstwy nie dają — całą ścieżkę persony głównej naraz — i dopiero wtedy zamyka
bramki, gdy jest już co bramkować.

Warstwa AI-natywna (jeden wiersz, Faza 4): przegląd „zimnego czytelnika" — agent multimodalny
przechodzi 1–3 krytyczne ekrany i orzeka, czy reguła domenowa jest odkrywalna **bez tutoriala**.
To jedyne kryterium sukcesu z PRD, którego żaden test deterministyczny nie postawi, bo dotyczy
zrozumiałości dla obcego, a nie wartości. **Kiedy NIE używać:** do weryfikacji sum punktowych,
werdyktu progu, stanu przycisku ani czegokolwiek liczbowego — to jest deterministyczne, tańsze
i już pokryte. Nie jest bramką wymaganą.

Status vocabulary (fixed — parser literals): `not started` → `change opened` → `researched`
→ `planned` → `implementing` → `complete`.

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit (czyste moduły) | Vitest | ^4.1.11 | `npm test` = `vitest run`, zakres `src/**/*.test.ts`; 17 plików, wszystkie w `src/lib/` |
| integration (trasy, baza) | none yet — see Phase 1 i Phase 2 | — | Rozstrzygnięte 2026-09-07: wykonanie trasy w Vitest jest zgodne z regułą czystości, gdy `@/lib/supabase` jest w teście podmieniony hoistowanym `vi.mock`; sonda w badaniu Fazy 1 przeprowadziła całą sekwencję `POST /api/teams` aż do redirectu, bez zmian w konfiguracji Vitest. Konsekwencja: warstwa nie potrzebuje ani nowego runnera, ani przegrody w `vitest.config.ts`, ani zmiany `ci.yml` — wybór konkretnej opcji wykonania należy do Fazy 1 |
| component (DOM) | none yet — see Phase 3 | — | Brak środowiska DOM; zakres Vitest obejmuje `.ts`, nie `.tsx` |
| e2e | none yet — see Phase 4 | — | Wzorzec dla Astro SSR: `webServer` uruchamiający `npm run preview`; `wrangler dev` jest w tym repozytorium zakazany |
| lint + typecheck | ESLint + `astro sync` | ESLint ^9.29.0 | Już w CI; `astro sync` musi poprzedzać lint, inaczej reguły typowane padają |
| build | Astro + adapter Cloudflare | Astro ^6.3.1 | Już w CI; jedyny krok wymagający sekretów Supabase |
| (optional) AI-native | przegląd „zimnego czytelnika" na 1–3 ekranach — checked: 2026-09-07 | n/a | NIE używać do wartości liczbowych, werdyktu progu ani stanu przycisku — te są deterministyczne i tańsze |

Ograniczenia twarde wiążące wybór warstw (`AGENTS.md`): `zod` nie jest zależnością i nie wolno jej
dodawać bez polecenia; `wrangler dev` jest zakazany (dev to `npm run dev` przez plugin Vite);
`supabase config push` jest zakazany; potwierdzanie adresu e-mail jest **włączone w produkcji
i wyłączone w `config.toml`** — rozjazd świadomy, nie do „naprawienia".

Czystość testów — obowiązująca litera (`AGENTS.md`, którego reguła jest właścicielem; tu tylko
cytowana): kryterium jest **runtime, nie treść linii importu**. Nic pod testem nie może
**ewaluować** modułu rozwiązującego wirtualny moduł `astro:*` ani konstruować prawdziwego klienta
Supabase. Wynika z tego, że warstwy wykonawcze są dostępne bez wyjątku od reguły:

- `import type { APIRoute } from "astro"` jest w porządku — typy są kasowane przy transpilacji;
- `node:fs` jest w porządku (precedens: `src/lib/teams-policy-sql.test.ts` czyta tak migracje);
- plik, który importuje `@/lib/supabase` — na przykład trasa API — **może** być pod testem, o ile
  test podmienia ten moduł hoistowanym `vi.mock("@/lib/supabase", …)`: prawdziwy moduł nigdy się
  wtedy nie ewaluuje;
- prawdziwego klienta nie wolno zbudować w teście nigdy — atrapa idzie jako argument, który moduły
  danych w `src/lib/` i tak już przyjmują.

**Stack grounding tools (current session):**
- Docs: none — Context7 ani inny MCP dokumentacji nie jest udostępniony w tej sesji; oparto się na lokalnych manifestach i konfiguracjach; checked: 2026-09-07
- Search: WebSearch (wbudowany) — potwierdzono wzorzec `webServer` → `npm run preview` dla Astro SSR wg oficjalnej dokumentacji Astro; generyczne poradniki zalecają `wrangler dev`, co łamie twardą regułę repozytorium — reguła projektu wygrywa; checked: 2026-09-07
- Runtime/browser: none — Playwright MCP nie jest udostępniony w tej sesji; e2e planowane jako zwykła zależność projektu, nie jako MCP; checked: 2026-09-07
- Provider/platform: none — MCP dla Supabase, Cloudflare ani GitHub nie są udostępnione (dostępny wyłącznie Google Calendar, bez związku z bramkami); checked: 2026-09-07

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| `astro sync` + lint + typecheck | local + CI | required (wired) | dryf składniowy i typowy, brakujące typy generowane |
| unit na czystych modułach | local + CI | required (wired) | regresje reguły domenowej i pomocników |
| integration na torze zapisu | local + CI | required after §3 Phase 1 | utrwalenie składu łamiącego próg albo limity |
| integration na izolacji i przepuszczaniu | local + CI | required after §3 Phase 2 | przepuszczenie żądania bez sesji; wypuszczenie przez trasę wiersza cudzego konta |
| dym ręczny na politykach RLS (lokalny stos) | local (`npx supabase start`) | recommended after §3 Phase 2 | regresja polityki RLS niewidzialna dla CI — bramka integracyjna idzie na atrapie klienta, więc rozbrojenie polityki w migracji przejdzie w niej na zielono |
| component na podpięciu wyspy | local + CI | required after §3 Phase 3 | rozjazd wykresu i werdyktu ze składem |
| build | CI | required (wired) | awarie wyłącznie kompilacyjne i konfiguracyjne |
| e2e na ścieżce persony głównej | CI on PR | required after §3 Phase 4 | zerwana ścieżka rejestracja → logowanie → zapisana drużyna |
| hook po edycji | local (pętla agenta) | recommended after §3 Phase 4 | regresje w chwili edycji; **nie zastępuje CI** |
| przegląd multimodalny (1–3 ekrany) | CI on PR | optional after §3 Phase 4 | nieodkrywalność reguły domenowej bez tutoriala |
| dym ręczny przeciwko produkcji | między scaleniem a produkcją | recommended after §3 Phase 4 | tor potwierdzania adresu, którego lokalny stos **nie** wykonuje |

## 6. Cookbook Patterns

Jak dodawać testy w tym projekcie. Każda podsekcja wypełnia się, gdy odpowiednia faza
wdrożenia zostanie dowieziona; przedtem czyta się „TBD — see §3 Phase `<N>`".

### 6.1 Dodanie testu jednostkowego czystego modułu

- **Lokalizacja**: obok modułu pod testem w `src/lib/` lub `src/lib/domain/`.
- **Nazewnictwo**: `<moduł>.test.ts` — zakres Vitest obejmuje wyłącznie `src/**/*.test.ts`.
- **Czystość**: obowiązuje kryterium runtime opisane w §4 — liczy się, co **ewaluuje się**
  w czasie testu, nie co mówi linia importu. Czysty moduł w `src/lib/` spełnia je bez żadnego
  zabiegu. Gdy moduł pod testem sięga po `@/lib/supabase`, drogą zgodną z regułą jest podmiana
  tego modułu w teście hoistowanym `vi.mock`; wydzielenie czystego rdzenia pozostaje
  **dopuszczalnym wyborem pokrycia, nie wymogiem zgodności**.
- **Test referencyjny**: `src/lib/domain/evaluate-team.test.ts`.
- **Uruchomienie**: `npm test`.

### 6.2 Dodanie testu integracyjnego toru zapisu

- TBD — see §3 Phase 1 (wzorzec odmowy zapisu dla składu poniżej progu i łamiącego limity).

### 6.3 Dodanie testu izolacji między kontami

- TBD — see §3 Phase 2 (wzorzec „konto A na identyfikatorze konta B dostaje zero wierszy",
  wykonywany, nie grepowany po SQL-u).

### 6.4 Dodanie testu bariery trasy

- TBD — see §3 Phase 2 (wzorzec „żądanie bez sesji na trasę chronioną kończy się
  przekierowaniem", z wariantami zapisu adresu).

### 6.5 Dodanie testu podpięcia wyspy

- TBD — see §3 Phase 3 (wzorzec „zmiana perka przesuwa werdykt progu w obie strony").

### 6.6 Dodanie testu e2e ścieżki persony głównej

- TBD — see §3 Phase 4 (wzorzec przebiegu rejestracja → logowanie → zapisana drużyna oraz
  granica między tym, co pokrywa automat, a tym, co zostaje dymem ręcznym).

### 6.7 Notatki z faz wdrożenia

(Uzupełniane po każdej dowiezionej fazie — 2–3 linie o tym, co faza okazała się uczyć.)

## 7. What We Deliberately Don't Test

Wyłączenia uzgodnione w wywiadzie (Faza 2, Q5). Respektuj je, dopóki nie zmieni się założenie
leżące u ich podstaw.

- **Responsywność i urządzenia mobilne** — PRD jawnie zdejmuje gwarancję (`## Non-Goals`,
  układ dwukolumnowy zakłada szeroki ekran), więc test tego wymiaru to koszt bez pokrycia
  ryzyka. Przewartościuj, jeśli PRD przywróci gwarancję mobilną. (Źródło: interview Q5.)
- **Prymitywy `src/components/ui/*` z shadcn** — cudzy kod, generator jest testem. Testujemy
  sposób ich użycia, nie je same. Przewartościuj, jeśli prymityw zostanie rozwidlony i zacznie
  nieść logikę projektu. (Źródło: interview Q5.)
- **Snapshoty pikselowe wykresu pajęczynowego** — współrzędne są już związane testem
  jednostkowym geometrii, a snapshot psułby się przy każdej korekcie stylu, nie łapiąc żadnej
  regresji reguły. Przewartościuj, jeśli pojawi się deterministyczna różnica wizualna
  z progiem tolerancji. (Źródło: interview Q5.)
- **Dostarczalność poczty przy potwierdzaniu adresu** — PRD **świadomie przyjmuje** to ryzyko
  (FR-001, zmiana decyzji 2026-08-30). Testujemy tor po potwierdzeniu, nie to, czy list
  doszedł. Przewartościuj, jeśli PRD cofnie akceptację tego ryzyka. (Źródło: PRD FR-001.)
- **Zgodność z WCAG-AA** — poza zakresem MVP (`## Non-Goals`); nazwy dostępne przycisków
  akcji pozostają zwykłym wymaganiem funkcjonalnym, ale audytu dostępności nie prowadzimy.
  Przewartościuj, jeśli dostępność wejdzie do kryteriów sukcesu. (Źródło: PRD `## Non-Goals`.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-07
- Stack versions last verified: 2026-09-07
- AI-native tool references last verified: 2026-09-07
- Ostatni refresh: 2026-09-07 — wyzwalacz: przepisanie reguły czystości testów w `AGENTS.md`
  (commit `62a6f68`) z kryterium tekstowego na runtime; dotknięte sekcje: §2, §3, §4, §5, §6.1,
  §6.3. Wpis jest jednorazowy — kolejny refresh nadpisuje tę linię, nie dopisuje kolejnej.

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
