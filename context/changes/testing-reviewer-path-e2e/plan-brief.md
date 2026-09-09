# Ścieżka recenzenta e2e i bramki jakości — krótki plan

> Pełny plan: `context/changes/testing-reviewer-path-e2e/plan.md`
> Badania: `context/changes/testing-reviewer-path-e2e/research.md`
> Tożsamość zmiany: `context/changes/testing-reviewer-path-e2e/change.md`

## Co i dlaczego

Faza 4 planu testów domyka ryzyko #4: „recenzent nie domyka ścieżki rejestracja → potwierdzenie
adresu → logowanie i ocenia produkt, do którego nie wszedł". Persona główna wchodzi **raz**, ma kilka
minut i nie ma pomocy z zewnątrz — zerwana ścieżka wejścia kosztuje cały projekt, a dziś nie pilnuje
jej ani jedna warstwa wykonawcza. Faza dostarcza automat na tor, który aplikacja naprawdę posiada,
egzekwowalny dym na człon, którego żaden automat uczciwie nie pokryje, oraz rozstrzygnięcie trzech
bramek §5.

## Punkt wyjścia

`e2e/seed.spec.ts` istnieje jako **rusztowanie, nie rozstrzygnięcie fazy**: pokrywa tor od logowania
w dół, wymaga konta i dwóch zmiennych podanych z ręki, a `playwright.config.ts` świadomie nie startuje
serwera. §6.6 przewodnika to `TBD`, §3 wiersz 4 ma `not started`, §5 żąda e2e na `CI on PR`.
Badanie przesondowało, że lokalny stos **nie wykonuje** toru potwierdzania (`AUTOCONFIRM=true`
wpieczone w kontener), że da się go wywołać backdoorem do `auth.users` — ale wtedy asercjonuje się
GoTrue, nie aplikację — i że spełnienie bramki CI wymaga Dockera w CI, czyli unieważnienia założenia,
na którym stoi granica CI/ręczne Fazy 2.

## Pożądany stan końcowy

`npx playwright test` na czystym drzewie z `.env` wskazującym lokalny stos sam stawia aplikację, sam
zakłada konto i przechodzi całą ścieżkę persony głównej — od rejestracji, przez produkcyjnie wierny
ekran potwierdzenia i logowanie, do zapisanej drużyny i jej usunięcia. Ten sam przebieg skierowany
gdziekolwiek indziej **odmawia** z jednym czytelnym komunikatem. Sonda mutacyjna wykazuje trzema
przebiegami, że test czerwieni się na zerwanej propagacji ciasteczka sesji. Człon, którego automat nie
pokrywa, ma skrypt dymu, którego nie da się zakończyć zerem bez dowodu wykonania — i który usuwa po
sobie konto w produkcyjnej bazie.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
| --- | --- | --- | --- |
| Granica automatu | Szew na potwierdzeniu, **bez** backdoora do `auth.users` | Każdy dostępny automat na ten człon asercjonuje GoTrue, nie aplikację, i nie pokrywa wylądowania recenzenta | Badania → Plan |
| Bramka §5 e2e | Osłabiona z `CI on PR` do `local + przed oddaniem`, jako **jawny wyjątek od zamrożenia §1–§5**, z powodem przy wierszu i wpisem do §8 | Spełnienie w CI unieważnia jawne założenie granicy CI/ręczne Fazy 2 — decyzja nie należy do tej fazy; a zmiana strategii w zamrożonej sekcji musi być odróżnialna od dryfu | Badania → Plan |
| Kształt dymu produkcyjnego | Skrypt hybrydowy: sondy wykonane + odmowa zera bez oddanego dowodu | „Dym wykonany" staje się stanem obserwowalnym, nie deklaracją; precedens `probe-save-barrier.sh` | Plan |
| Kadencja dymu i konto testowe | „Przed oddaniem projektu"; **usunięcie konta jest krokiem skryptu** | Persona wchodzi raz; pozycja długu `deploy-plan.md:234-235` stoi otwarta i od 2026-08-30 urosła | Plan |
| Uruchamianie aplikacji | `webServer: npm run preview` | Preview serwuje **ten sam artefakt co wdrożenie** (worker na `workerd`, `import.meta.env.DEV` fałszywe), a test broni ścieżki produkcyjnej; rozjazd kopii `/auth/confirm-email` jest dowodem tej klasy, nie całym powodem | Badania → Plan → sonda 2026-09-09 |
| Strażnik anty-produkcyjny | `globalSetup`, czterema odmowami, czytający **oba** źródła zmiennych | Build zamraża stos w `dist/server/.dev.vars`, więc strażnik czytający tylko `.env` byłby zielony na rozbrojonym stanie | Plan (sonda tej sesji) |
| Konto testowe | Fixture zakłada własne konto przez `POST /api/auth/signup` (z `Origin`) | Lokalnie rejestracja autopotwierdza, więc konto kosztuje jedno żądanie; unikalny adres wymusza niezależność testów | Badania → Plan |
| Kontrola mutacyjna | Tak — zerwanie propagacji ciasteczka sesji w `src/lib/supabase.ts:17-21` | Jedyna awaria w kształcie ryzyka #4, której **żadna warstwa poniżej e2e nie widzi** | Badania → Plan |
| Człon AI-natywny | Jednorazowy przegląd zimnego czytelnika, ustalenia do §6.7 | Domyka jedyne kryterium PRD, którego test deterministyczny nie postawi; §3 wprost mówi „nie jest bramką" | Plan |

## Zakres

**W zakresie:**

- `webServer` na `npm run preview` + `globalSetup` ze strażnikiem stosu (cztery odmowy)
- `e2e/seed.spec.ts`: fixture zakładający konto, nowy człon „rejestracja daje widoczną drogę dalej"
- `scripts/probe-reviewer-path.{sh,patch}` — sonda mutacyjna, trzy przebiegi, dwa buildy
- `scripts/smoke-reviewer-path.sh` — dym produkcyjny z odmową zera i usunięciem konta
- `test-plan.md`: §6.6 wypełnione, §6.7 nota, §3 status, §4 wiersz e2e, §5 trzy wiersze bramek,
  §8 przedatowanie przeglądu strategii + linia nazywająca wyjątek (linia `Ostatni refresh` nietknięta)
- `deploy-plan.md`: domknięcie pozycji konta testowego; `AGENTS.md`: jedno zdanie o `.env` → `build` → `test`
- Jednorazowy przegląd zimnego czytelnika na 1–3 ekranach

**Poza zakresem:**

- Stos Supabase w CI (`services:`, Docker) — decyzja należy do Fazy 2 albo do obu faz wspólnie
- Jakakolwiek zmiana `supabase/config.toml` — trzy pola, w tym dwa najgroźniejsze
- Automat na potwierdzaniu oparty na zapisie do `auth.users`; Mailpit w ogóle
- `exchangeCodeForSession` / trasa `/auth/callback` — zmiana produktu, nie testów
- `storageState`, projekt `setup`, nowe zależności, atrybuty testowe w `src/`
- Naprawa czerwonego `npx astro check`; `.env.local` w `.gitignore`; §1 i §7 `test-plan.md`; `ci.yml`

## Architektura / Podejście

```
.env (lokalny stos)  ──►  npm run build  ──►  dist/server/.dev.vars  ──►  npm run preview
        │                                              │                        │
        └──────────── strażnik e2e/stack-guard.ts czyta OBA ────────────────────┘
                             │ (+ GET /auth/v1/health lokalnego stosu)
                             ▼
                   npx playwright test ──► e2e/seed.spec.ts
                                              ├── rejestracja → „Check your email" → logowanie
                                              └── logowanie → skład → zapis → trwałość → usunięcie
                                                       ▲
                        scripts/probe-reviewer-path.sh ─┘  (zielony → czerwony → zielony)

produkcja ──► scripts/smoke-reviewer-path.sh ──► 3 sondy wykonane + 2 kroki ręczne + odmowa zera
```

Ustalenie, które wiąże cały ten łańcuch: **build zamraża `SUPABASE_URL` w `dist/server/.dev.vars`,
a preview czyta ten plik, nie `.env`.** Stąd kolejność `.env → build → test`, stąd strażnik czytający
dwa pliki, stąd dwa buildy w sondzie mutacyjnej.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Osprzęt i strażnik | `webServer` na preview + `globalSetup` z czterema odmowami | Strażnik czytający tylko `.env` byłby zielony na rozbrojonym stanie |
| 2. Test ścieżki recenzenta | Test samowystarczalny + człon „rejestracja daje drogę dalej" | Pokusa dopisania asercji „recenzent wylogowany" — lokalnie fałszywej |
| 3. Kontrola mutacyjna | Łatka na propagację ciasteczka + skrypt o trzech przebiegach | Zapomniana przebudowa → sonda zielona i kłamie |
| 4. Dym produkcyjny | Skrypt z odmową zera + domknięcie długu konta testowego | Trzecie z rzędu „przyjęcie długu" zamiast jego domknięcia |
| 5. Przewodnik i bramki | §6.6/§6.7/§3/§4/§5, `AGENTS.md`, przegląd zimnego czytelnika | Osłabienie bramki czytane jako niedokończona robota, nie decyzja |

**Wymagania wstępne:** Node 22.14.0 (`nvm use` + `hash -r`); `npx supabase start` działający lokalnie;
gotowość do przestawienia `.env` na lokalny stos; dostęp do produkcji i panelu Supabase (Faza 4);
przeglądarki Playwrighta (`npx playwright install chromium`).

**Szacowany nakład pracy:** ~3–4 sesje w 5 fazach. Faza 4 jest najbardziej ręczna i jej potwierdzenie
jest potwierdzeniem samego pokrycia ryzyka #4.

## Otwarte ryzyka i założenia

- **Faza 4 jest otwierana poza kolejnością** (Fazy 2 i 3 mają `not started`) z powodu kontekstu
  kursowego, nie rewizji uzasadnienia z §3. Uzasadnienie kolejności zostaje w mocy i plan mówi to wprost.
- **Człon „recenzent ląduje wylogowany" nie ma i nie będzie miał automatu.** Pilnuje go wyłącznie dym;
  jeśli dym nie będzie wykonywany, ryzyko #4 zostaje na papierze. Odmowa zera jest jedyną barierą.
- **Osłabiona bramka §5 nie broni PR-ów.** Zerwana ścieżka recenzenta może wejść do `main` niezauważona;
  to świadomie przyjęte, do przewartościowania, gdy Faza 2 rozstrzygnie kwestię Dockera w CI.
- ~~**`npm run preview` pod `@astrojs/cloudflare` v13 nie został uruchomiony**~~ — **domknięte sondą
  2026-09-09**: build wytwarza `.wrangler/deploy/config.json` i `dist/server/.dev.vars`, preview wstaje
  w ~2 s, wypisuje `Using secrets defined in dist/server/.dev.vars`, `GET /auth/signin` → 200,
  a `/auth/confirm-email` renderuje kopię **produkcyjną**. Ryzyko zamknięte przed implementacją;
  kryterium Fazy 1 zostaje jako regresja, nie jako odkrycie.
- **Konta testowe gromadzą się w lokalnej `auth.users`** — świadomie niesprzątane (stos lokalny jest
  wyrzucalny przez `supabase db reset`); sprzątanie wymagałoby backdoora, którego ta zmiana odrzuca.

## Kryteria sukcesu (podsumowanie)

- Jednym poleceniem, bez żadnej zmiennej podanej z ręki, przechodzi cała ścieżka persony głównej —
  a skierowanie tego polecenia gdziekolwiek poza lokalny stos kończy się odmową, nie przebiegiem.
- Test jest przesondowany: wykazano jego czerwień na awarii, której żadna tańsza warstwa nie widzi.
- Człon nieautomatyzowalny ma dym, którego nie da się „wykonać" bez wykonania — a konto, które ten
  dym zakłada w produkcji, znika w tym samym przebiegu.
