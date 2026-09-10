<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Ścieżka recenzenta e2e i bramki jakości

- **Plan**: `context/changes/testing-reviewer-path-e2e/plan.md`
- **Zakres**: Fazy 1–5 z 5 (pełny plan; Progress 46/46 `[x]`), commity `e136707..HEAD`
- **Data**: 2026-09-10
- **Werdykt (stan zastany)**: ODRZUCONY — decydowało F1
- **Werdykt po triażu 2026-09-10**: ZAAKCEPTOWANY — F1 naprawione i przesondowane; 6 z 9 ustaleń naprawionych, 2 pominięte decyzją użytkownika
- **Ustalenia**: 1 krytyczne, 5 ostrzeżeń, 3 obserwacje

## Werdykty

| Wymiar                | Werdykt |
| --------------------- | ------- |
| Zgodność z planem     | WARNING |
| Dyscyplina zakresu    | PASS    |
| Bezpieczeństwo i jakość | FAIL  |
| Architektura          | PASS    |
| Spójność wzorców      | WARNING |
| Kryteria sukcesu      | WARNING |

## Weryfikacja kryteriów — co faktycznie uruchomiono

Uruchomione i **zielone**: cztery odmowy strażnika (#1 root `.dev.vars`, #2 `.env` na hostowanym,
#3 build zamrożony na innym stosie, #4 stos zatrzymany — każda wywołana osobno, każda z odrębnym
komunikatem), `npx playwright test` (2 passed, dwukrotnie), `npx tsc --noEmit`, `npm run lint`
(0 errors), `npm test` (238 passed / 18 plików), `git apply --check` łatki, `scripts/probe-reviewer-path.sh`
(**exit 0** — zielony → czerwony → zielony wykazane), odmowa sondy na brudnym drzewie (exit 2, drzewo
nietknięte), odmowa sondy na zajętym porcie (exit 6 — wywołana realnie, nie sztucznie),
`scripts/smoke-reviewer-path.sh` (3/3 sondy przeciwko produkcji, exit 2 bez terminala),
`grep`/`diff` kryteria 2.2, 2.3, 4.4, 5.1–5.8 (w tym §1/§7/`ci.yml` bit-identyczne z `e136707`).

Uruchomione i **czerwone / niemierzące**: kryterium 2.5 (patrz F3), kryterium 4.3 (patrz F4).

Niezweryfikowane bezpośrednio: 3.5 (przerwanie sygnałem w trakcie przebiegu 2), 4.5/4.6 (pełny dym
przeciwko produkcji i usunięcie kont — z natury nie zostawiają śladu w repozytorium).

## Ustalenia

### F1 — `reuseExistingServer: true` obchodzi odmowę #3; e2e może pobiec przeciwko projektowi hostowanemu

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `playwright.config.ts:57-67`, `e2e/stack-guard.ts:161-177`
- **Szczegóły**: Strażnik czyta `dist/server/.dev.vars` **z dysku**, a reużyty proces preview serwuje
  kompilację zamrożoną w chwili **swojego startu**. Te dwa stany się rozjeżdżają i nic tego nie
  wiąże. Sonda wykonana w tej sesji: preview wystartowany na buildzie wskazującym
  `zzzzfake.supabase.co`, następnie `.env` → lokalny + `npm run build` (czyli `dist/server/.dev.vars`
  wskazuje `127.0.0.1:54321`) → `npx playwright test` **przeszedł przez wszystkie pięć odmów**
  i padł dopiero na `signup?error=internal%20error` z obcego Supabase. Odmowa #3 nie zadziałała.
  Plan twierdzi wprost (`plan.md:283`): „`reuseExistingServer: true` … ta wygoda jest bezpieczna
  **wyłącznie** dzięki odmowie #3, która pilnuje, co ten proces serwuje" — nie pilnuje. Komentarz
  `playwright.config.ts:57-60` nazywa dziurę węziej, niż ona jest: „reużycie **preview** jest
  pokryte" jest fałszywe, pokryty jest tylko preview wystartowany **po** ostatnim buildzie.
  Scenariusz nie jest hipotetyczny: pierwszy przebieg e2e w tej sesji reużył cudzy proces `astro preview`
  wystartowany o 07:06, o czym dowiedziałem się dopiero z odmowy #6 sondy mutacyjnej. Gdyby ten proces
  stał na buildzie z prawdziwymi poświadczeniami hostowanymi, `registerAccount` (`seed.spec.ts:88-104`)
  utworzyłby **realne konto w produkcyjnej bazie i wysłał realny list** — dokładnie ten dług, który
  Faza 4 zamykała. To ta sama klasa co `lessons.md` §„Strażnik musi mierzyć to, co deklaruje".
- **Poprawka A ⭐ Zalecana**: `reuseExistingServer: false` w `playwright.config.ts:64`.
  - Siła: Zamyka lukę w całości i u źródła — Playwright odmawia startu przy zajętym porcie, czyli
    zamienia cichy fałszywy przebieg w głośną odmowę. Usuwa przy okazji W-2 sondy mutacyjnej
    (wyścig reużycia między przebiegiem 1 a 2, gdy `workerd` przeżyje SIGTERM).
  - Kompromis: Znika wygoda ręcznie postawionego preview; każdy przebieg płaci ~2 s startu.
  - Pewność: HIGH — luka odtworzona sondą, poprawka jednolinijkowa, `dist/` jest już gotowe, więc
    start preview nie zawiera builda.
  - Martwy punkt: Nie sprawdzono, czy jakiś lokalny nawyk pracy zakłada trwale stojący preview.
- **Poprawka B**: Szósta odmowa w `stack-guard.ts` — porównać czas startu procesu nasłuchującego
  na porcie `baseURL` z `mtime` pliku `dist/server/.dev.vars` i odmówić, gdy proces jest starszy.
  - Siła: Zachowuje `reuseExistingServer` i mieści się w istniejącej konwencji „jedna odmowa na
    przyczynę, każda z instrukcją co zrobić".
  - Kompromis: Wprowadza zależność od `lsof`/`ps` (spoza `package.json`, patrz F8) i mierzy proxy
    zamiast rzeczy — proces wystartowany po buildzie, ale z innego katalogu, nadal przejdzie.
  - Pewność: MEDIUM — kierunek poprawny, ale kruchszy niż A i większy w kodzie.
  - Martwy punkt: Zachowanie `lsof` w środowiskach bez niego (patrz O-6 przeglądu).
- **Decyzja**: NAPRAWIONE poprawką A — `reuseExistingServer: false` w `playwright.config.ts:64`, komentarz `:57-62` przepisany na prawdę o rozjeździe (sonda 2026-09-10). Zweryfikowane: `npx playwright test` 2 passed, `tsc` i `lint` zielone.

### F2 — Ścieżka `exit 5` sondy zostawia rozbrojone `dist/` bez ostrzeżenia

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `scripts/probe-reviewer-path.sh:56-67, 150-163`
- **Szczegóły**: `cleanup()` ostrzega o rozbrojonej kompilacji **tylko** gdy `PATCH_APPLIED == 1`.
  W przebiegu 3 flaga jest zerowana (`:152`) **przed** przebudową. Gdy ta przebudowa padnie, skrypt
  kończy się kodem 5, a `dist/` nadal zawiera workera z zerwanym `setAll` — przy czym `git status`
  jest **czysty**, bo drzewo źródłowe wróciło do stanu z repozytorium. Kolejne `npx wrangler deploy`
  wysłałoby na produkcję build bez propagacji ciasteczka sesji. Dodatkowo `exit 5` nie odróżnia
  „padła przebudowa" (`RUN3 == 90`) od „czerwone e2e" — przebieg 2 to rozróżnienie ma (`:141-145`),
  przebieg 3 nie.
- **Poprawka**: Osobna flaga `DIST_DIRTY=1` ustawiana przy pierwszym buildzie z łatką i zerowana
  dopiero po **udanej** przebudowie bez łatki; ostrzeżenie o `dist/` przenieść pod nią, poza warunek
  `PATCH_APPLIED`. Przy okazji rozdzielić `RUN3 == 90` od `RUN3 != 0`.
- **Decyzja**: NAPRAWIONE — osobna flaga `DIST_DIRTY` (ustawiana przed buildem z łatką, zerowana dopiero po udanej przebudowie bez niej), ostrzeżenie o `dist/` wyprowadzone poza warunek `PATCH_APPLIED` i zerujące flagę przy wypisaniu (bez tego `on_signal` + trap EXIT dawały duplikat), `RUN3 == 90` rozdzielone od `RUN3 != 0`. Zweryfikowane: pełny przebieg → exit 0; przerwanie SIGTERM w trakcie przebiegu 2 → exit 130, drzewo czyste, ostrzeżenie raz (to zarazem domyka niezweryfikowane wcześniej kryterium 3.5).

### F3 — Kryterium 2.5 uruchomione dosłownie jest czerwone, a plan opisuje je jako zielone na bazie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/testing-reviewer-path-e2e/plan.md` (Faza 2, „Niezmiennik utrzymaniowy antywzorców"), Progress 2.5
- **Szczegóły**: `! grep -rnE 'waitForTimeout|getByTestId|page\.(locator|\$\$?)\(' e2e/` zwraca
  **3 trafienia** na HEAD (`seed.spec.ts:13`, `:15`, `:157`) i **3 trafienia** na `e136707`
  (`:13`, `:15`, `:76`) — wszystkie w komentarzach, które opisują dokładnie to, czego grep ma nie
  znaleźć. Kryterium jest więc czerwone w obu połówkach, a plan zapisał je jako „**Zielony na bazie
  świadomie**". Intencja jest spełniona (poza komentarzami zero trafień, zweryfikowane), ale `[x]`
  podpisano przy komendzie, która dosłownie nie przechodzi. Szóste wystąpienie klasy z `lessons.md`
  §„Kryteria grepowe kotwicz na składni, nie na słowach — komentarze też są w pliku", która sama
  mówi: „`[x]` nie znaczy »intencja spełniona«, tylko »komenda zielona«".
- **Poprawka**: Przepisać kryterium na wariant strzygący komentarze — np.
  `! grep -rnE 'waitForTimeout|getByTestId|page\.(locator|\$\$?)\(' e2e/ | grep -vE ':\s*[0-9]+:\s*(\*|//)'`
  — i poprawić opis w planie z „zielony na bazie" na „czerwony w obu, mierzy przyrost".
- **Decyzja**: NAPRAWIONE — kryterium w planie (`Faza 2` i Progress 2.5) przepisane na wariant strzygący komentarze, kotwiczony na `[0-9]+:` bez wiodącego `:`, żeby ten sam wzorzec działał na `grep -rn` po katalogu i na `git show <sha>:<plik> | grep -n`. Opis „zielony na bazie świadomie" zastąpiony prawdą („czerwony w obu połówkach bez strzyżenia"). Przesondowane wariantem **rozbrajającym**: zielone na HEAD i na `e136707`, czerwone po dopisaniu prawdziwego `page.waitForTimeout(100)`.

### F4 — Kryterium 4.3 nie mierzy walidacji, którą deklaruje; 4.2 i 4.3 to jedna bariera

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `scripts/smoke-reviewer-path.sh:110-144`, Progress 4.2 i 4.3
- **Szczegóły**: Kryterium 4.3 („adres bez `code=` albo na innym hoście → niezerowo") jest zapisane
  jako **automatyczne**, ale brama `[[ ! -t 0 ]]` (`:110`) odcina przed `read`. Zweryfikowane:
  `printf 'https://evil.example.com/?code=abc' | bash scripts/smoke-reviewer-path.sh` → **exit 2**
  z komunikatem „Brak terminala", identycznie jak `< /dev/null`; to samo dla adresu bez `code=`.
  Walidacja z `:125-144` (schemat, host, `code=`) nigdy się nie wykonuje. Próba obejścia przez PTY
  (`script -q /dev/null`) też nie dochodzi do walidacji — `read` czyta wtedy z terminala, nie z potoku.
  Sama walidacja jest zaimplementowana poprawnie i czytelnie; problem jest w **klasyfikacji**
  kryterium: 4.3 przechodzi na dowodzie należącym do 4.2. `lessons.md` §„Strażnik musi mierzyć to,
  co deklaruje": „Gdy asercja wiąże to samo co licznik, licznik skreśl — dubluje słabszą wersję tej
  samej umowy i tworzy złudzenie dwóch niezależnych barier".
- **Poprawka**: Przenieść 4.3 do kryteriów **ręcznych** (albo wyodrębnić walidację do funkcji
  wołanej z argumentu, np. `smoke-reviewer-path.sh --check-landing <url>`, żeby dała się związać
  automatem). Pozostawienie jej wśród automatycznych utrwala złudzenie dwóch barier.
- **Decyzja**: NAPRAWIONE — walidacja wydzielona do funkcji `validate_landing()` (jedno źródło prawdy dla bramy ręcznej i automatu) plus bezstanowy tryb `scripts/smoke-reviewer-path.sh --check-landing <adres>`: 0 dla poprawnego, 3 dla złego hosta / braku `code=` / adresu nieabsolutnego / pustego, bez sieci i bez bram. Kryterium 4.3 w planie przepisane na ten tryb, nagłówek skryptu go dokumentuje. Zweryfikowane: pięć wariantów daje oczekiwane kody, 4.2 nadal kończy się kodem 2, pełny przepływ 3/3 sond bez zmian.

### F5 — Konwencja hydratacji weszła poza umową planu i w commicie niewłaściwej fazy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `e2e/seed.spec.ts:121-142`
- **Szczegóły**: Plan (Faza 2 pkt 3) mówił o istniejącym teście: „Wszystko poniżej — `openFromIsland`,
  `SOLUTION`, asercja trwałości, cleanup, siatka `afterEach` — **bez zmian**", a `fill` miał brać
  wartości ze zwróconej pary. Faktycznie doszły `waitForFormHydration` i `fillWhenHydrated` — nowa
  konwencja obowiązująca każdy formularz w wyspie, obok istniejącej `openFromIsland`. `fillWhenHydrated`
  wszedł w Fazie 2, mocniejszy `waitForFormHydration` dopiero w **bd2e70f** (commit Fazy 5), której
  umowa go nie obejmuje. Progress 2.1–2.7 jest podpisany commitem `aee9232`, więc odhaczenia Fazy 2
  nie pokrywają kodu, który dziś realizuje jej kryteria. Rozjazd jest **świadomy, nie cichy**: nazwany
  w komunikacie commita, zapisany w §6.6 i §6.7 `test-plan.md`, a wada produktowa wyprowadzona do
  osobnego folderu zmiany (`context/changes/form-island-hydration-race/`, dziś nietrackowany).
- **Poprawka A ⭐ Zalecana**: Dopisać do planu aneks przy Fazie 2 pkt 3 — jedno zdanie, że umowa
  „bez zmian" została rozszerzona o helper hydratacji, z powodem i odesłaniem do `bd2e70f`.
  - Siła: Plan jest źródłem prawdy dla `/10x-archive` i następnych przeglądów; bez aneksu następny
    czytelnik zobaczy kod, którego umowa zaprzecza. Repozytorium ma już precedens aneksów.
  - Kompromis: Plan staje się nieco ruchomym celem.
  - Pewność: HIGH — ustalenie jest już zapisane w §6.6/§6.7, aneks tylko domyka najbliższe miejsce.
  - Martwy punkt: Nie sprawdzono, czy `form-island-hydration-race` opisuje tę samą wadę w tych samych słowach.
- **Poprawka B**: Zostawić bez zmian — ustalenie jest udokumentowane w `test-plan.md` §6.6/§6.7
  i w komunikacie commita.
  - Siła: Zero pracy; plan pozostaje zapisem tego, co zaplanowano, nie tego, co zrobiono.
  - Kompromis: Rozjazd między umową planu a kodem zostaje, a Progress Fazy 2 wskazuje commit,
    który nie zawiera kodu domykającego jej kryteria.
  - Pewność: MEDIUM — zależy od tego, czy plan po archiwizacji jest jeszcze czytany.
  - Martwy punkt: Nie wiadomo, kiedy `form-island-hydration-race` zostanie otwarty.
- **Decyzja**: NAPRAWIONE poprawką A — aneks „2026-09-10 (przegląd implementacji, F5)" dopisany do Fazy 2 pkt 3 planu: nazywa oba helpery, powód (React 19 hydratuje istniejący DOM nie kasując wartości pól), dowód hydratacji przez obserwowalny skutek zamiast `waitForTimeout`, oraz dwie konsekwencje — że Progress 2.1–2.7 wskazuje `aee9232`, a kryteria przeliczono na HEAD w tym przeglądzie, i że sama wada produktowa należy do `context/changes/form-island-hydration-race/`.

### F6 — Trzy `curl` skryptu dymu bez limitu czasu

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `scripts/smoke-reviewer-path.sh:61, 65, 72`
- **Szczegóły**: Żadna z trzech sond nie ma `--max-time` ani `--connect-timeout`. Host, który przyjmuje
  połączenie i milczy (typowe dla zablokowanego edge albo firewalla), zawiesza dym bez końca — a jest
  to skrypt uruchamiany ręcznie przed oddaniem projektu, czyli w chwili największej presji czasu.
  Wzorzec istnieje w tej samej zmianie i nie został przeniesiony: `e2e/stack-guard.ts:121` używa
  `AbortSignal.timeout(HEALTH_TIMEOUT_MS)`. Powiązany drobiazg tej samej klasy: awaria sieci daje
  `%{http_code}` = `000` na wszystkich trzech sondach i komunikat „Produkcja nie zachowuje się jak
  powinna", co wskazuje winnego fałszywie.
- **Poprawka**: `curl -sS --connect-timeout 5 --max-time 20 …` w każdej z trzech sond; opcjonalnie
  rozpoznać `000` osobnym komunikatem „brak łączności", zamiast wliczać go w werdykt o produkcji.
- **Decyzja**: NAPRAWIONE — stała `CURL_TIMEOUTS=(--connect-timeout 5 --max-time 20)` w trzech sondach (odpowiednik `AbortSignal.timeout` ze strażnika), plus rozpoznanie `%{http_code}` = `000` na wszystkich trzech: osobny komunikat „Brak łączności z <host> … to NIE jest werdykt o produkcji". Zweryfikowane: przeciwko produkcji nadal 3/3 i exit 2; przeciwko `.invalid` — exit 1 z nowym komunikatem, w 0,08 s zamiast wiszenia; `--check-landing` bez regresji.

### F7 — `E2E_PORT` nie istnieje poza jedną linią; kontrola portu jest pusta przy nadpisanym adresie

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `scripts/probe-reviewer-path.sh:52`
- **Szczegóły**: `APP_PORT="${E2E_PORT:-4321}"`, a `E2E_PORT` nie występuje **nigdzie indziej w repozytorium**.
  Adres i port konfiguruje `E2E_BASE_URL` (`playwright.config.ts:42`). Kto ustawi
  `E2E_BASE_URL=http://localhost:5000`, dostanie kontrolę portu 4321 — pustą — przy zajętym 5000,
  czyli wpadnie w dokładnie ten scenariusz, przed którym odmowa 6 ostrzega. Osobno: `lsof` jest
  zależnością spoza `package.json` i `2>&1` przy nim zjada również „command not found", więc
  w środowisku bez `lsof` kontrola przechodzi zawsze.
- **Poprawka**: Wyprowadzić port z `E2E_BASE_URL` (parametr expansion), albo skreślić `E2E_PORT`
  i zapisać w nagłówku, że sonda nie obsługuje nadpisania adresu.
- **Decyzja**: POMINIĘTE — decyzja użytkownika w triażu 2026-09-10. `E2E_PORT` zostaje martwą kontrolą przy nadpisanym `E2E_BASE_URL`; przy domyślnym adresie odmowa 6 działa (zweryfikowana realnym trafieniem w tym przeglądzie).

### F8 — Odmowa #5 strażnika wykracza poza umowę Fazy 1 i unieważnia jej obietnicę o `E2E_BASE_URL`

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `e2e/stack-guard.ts:179-191`
- **Szczegóły**: Plan wylicza **cztery** rozłączne odmowy i zapisuje przy `baseURL`: „nadpisanie adresu
  **nadal działa** i nadal przechodzi przez strażnika". Implementacja dokłada piątą, która to nadpisanie
  ogranicza do pętli zwrotnej — czyli unieważnia zdanie umowy Fazy 1. Rozjazd jest dobrze poprowadzony:
  udokumentowany w komentarzu pliku (`:36-41`, z powodem i datą sondy), w docstringu konfiguracji,
  w §6.7 `test-plan.md`, a numeracja 1–4 została nietknięta, żeby kryteria planu nadal cytowały to samo.
  Merytorycznie odmowa jest **poprawna** i wzmacnia strażnika. Odnotowane jako rozjazd umowy, nie jako wada.
- **Poprawka**: Jedno zdanie aneksu przy Fazie 1 pkt 2 planu — że obietnica o `E2E_BASE_URL` została
  zawężona do adresów na pętli zwrotnej.
- **Decyzja**: POMINIĘTE — decyzja użytkownika w triażu 2026-09-10. Odmowa #5 jest merytorycznie poprawna i udokumentowana w komentarzu pliku, docstringu konfiguracji i §6.7; plan nie dostaje aneksu.

### F9 — §3 `test-plan.md`: przepisano też obietnicę pokrycia, a wyjątek w §8 nazywa tylko §5

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `context/foundation/test-plan.md:85`
- **Szczegóły**: Plan przewidywał w §3 wierszu 4 wyłącznie `Status: complete` i folder zmiany. Zmieniona
  została też kolumna obietnicy pokrycia: „a dolna granica zostaje zamknięta w CI" → „a człon, którego
  automat nie sięga, dostaje egzekwowalny dym". Treściowo jest to **spójne** z osłabieniem §5 i bez tej
  zmiany wiersz kłamałby. Ale §3 należy do zamrożonego bloku §1–§5, a linia wyjątku dopisana do §8
  nazywa wyłącznie „§5, wiersz `e2e na ścieżce persony głównej`" — więc ta jedna zmiana strategiczna
  jest nieodróżnialna od wypełnienia zaślepki, czyli dokładnie ta klasa, przed którą plan sam ostrzega
  w „Czego NIE robimy".
- **Poprawka**: Rozszerzyć linię wyjątku w §8 o wiersz 4 §3 (kolumna obietnicy pokrycia), z tym samym
  odesłaniem do folderu zmiany.
- **Decyzja**: NAPRAWIONE — linia wyjątku w §8 `test-plan.md` rozszerzona o drugi wiersz: §3 wiersz 4, kolumna obietnicy pokrycia, z powodem („bez tej zmiany wiersz kłamałby po osłabieniu §5, ale jest to zdanie strategiczne, nie zaślepka"). Zweryfikowane: `Ostatni refresh` nadal bit-identyczna z `e136707`, §1 i §7 nietknięte.

## Co przeszło bez zastrzeżeń

- **Dyscyplina zakresu — bez jednego naruszenia.** `supabase/` 0 linii diffu, `package.json`
  i `package-lock.json` 0 linii (zero nowych zależności), `.github/workflows/ci.yml` bit-identyczny,
  `src/` 0 linii diffu (więc też zero `data-testid`), brak `storageState`, zero wzmianek o Mailpicie,
  brak `exchangeCodeForSession` i trasy `/auth/callback`, §1 i §7 `test-plan.md` bit-identyczne
  z `e136707`. Żadnego pliku w diffie spoza planu.
- **Zamrożony hunk łatki** porównany dosłownie z blokiem w planie (`plan.md:455-464`) — identyczny
  co do znaku. `plan.md` we wszystkich commitach implementacyjnych zmieniał wyłącznie wiersze `Progress`.
- **Wyciek sekretów — konstrukcyjnie niemożliwy.** Jedyna droga wartości do komunikatu strażnika
  prowadzi przez `describeHost()` (`stack-guard.ts:107-117`), które zwraca `new URL(url).host`;
  `SUPABASE_KEY` nie jest nigdzie odczytywany. Usunięcie `requireEnv`/`E2E_EMAIL`/`E2E_PASSWORD`
  likwiduje klasę „sekret w zmiennej przekazywanej testowi" u źródła.
- **Skrypt dymu nie zapisuje niczego w produkcji** — dwa `GET` i jeden `POST` z jednorazowym adresem
  `smoke-<timestamp>@example.com`, który nie tworzy konta.
- **`trap` przed pierwszą modyfikacją drzewa** (`probe-reviewer-path.sh:74-75` vs `:127`), cleanup
  wyłącznie przez `git apply -R` na własnej łatce — nigdy `git checkout`/`restore`/`stash`; przy
  nieudanym cofnięciu skrypt **wypisuje** instrukcję zamiast wykonywać ją sam. Drzewo czyste po
  każdym z przebiegów wykonanych w tym przeglądzie.
- **Czystość modułowa `e2e/`** — `stack-guard.ts` importuje tylko `node:fs`/`node:path` i typy
  Playwrighta; `seed.spec.ts` tylko `@/lib/domain/*`. Zakaz rozwiązywania `astro:*` respektowany.
- **§8, §5, `AGENTS.md`** — linia `Ostatni refresh` bit-identyczna z bazą, zdanie powodu przy wierszu
  §5 zaczyna się od „Osłabione świadomie w Fazie 4", `AGENTS.md` ma dokładnie jedną linię `-` — tę,
  do której dopisano zdanie.


## Triaż — 2026-09-10

| Ustalenie | Decyzja |
| --- | --- |
| F1 — `reuseExistingServer` obchodzi odmowę #3 | NAPRAWIONE (poprawka A) |
| F2 — `exit 5` zostawia rozbrojone `dist/` | NAPRAWIONE |
| F3 — kryterium 2.5 czerwone dosłownie | NAPRAWIONE |
| F4 — kryterium 4.3 nie mierzy walidacji | NAPRAWIONE (`--check-landing`) |
| F5 — konwencja hydratacji poza umową | NAPRAWIONE (poprawka A — aneks w planie) |
| F6 — `curl` bez limitu czasu | NAPRAWIONE |
| F7 — martwy `E2E_PORT` | POMINIĘTE |
| F8 — odmowa #5 poza umową Fazy 1 | POMINIĘTE |
| F9 — §3 poza linią wyjątku §8 | NAPRAWIONE |

### Werdykty po naprawach

| Wymiar | Przed | Po |
| --- | --- | --- |
| Zgodność z planem | WARNING | PASS — F5 i F9 domknięte aneksami; F8 pominięte świadomie |
| Dyscyplina zakresu | PASS | PASS |
| Bezpieczeństwo i jakość | FAIL | PASS — F1, F2 i F6 naprawione i zweryfikowane sondami |
| Architektura | PASS | PASS |
| Spójność wzorców | WARNING | WARNING — F7 pominięte decyzją użytkownika |
| Kryteria sukcesu | WARNING | PASS — F3 i F4 mierzą teraz to, co deklarują |

### Brama końcowa na wynikowym stanie

`npm run lint` 0 errors (1 warning — znany dług bazowy `AppHeader.astro`) · `npx tsc --noEmit` zielone ·
`npm test` 238 passed / 18 plików · `npx playwright test` 2 passed ·
`scripts/probe-reviewer-path.sh` exit 0 (zielony → czerwony → zielony) · przerwanie SIGTERM w przebiegu 2 →
exit 130, drzewo czyste, ostrzeżenie o `dist/` raz · `smoke-reviewer-path.sh` 3/3 sond, exit 2 bez terminala,
`--check-landing` 0/3 wedle adresu · `.github/workflows/ci.yml` nadal bit-identyczny z `e136707` ·
§1, §7 `test-plan.md` i linia `Ostatni refresh` nadal bit-identyczne z `e136707`.

### Pliki dotknięte triażem

`playwright.config.ts` (F1) · `scripts/probe-reviewer-path.sh` (F2) · `scripts/smoke-reviewer-path.sh` (F4, F6) ·
`context/changes/testing-reviewer-path-e2e/plan.md` (F3, F4, F5) · `context/foundation/test-plan.md` (F9).
Zmiany nie są zacommitowane — leżą w drzewie roboczym.
