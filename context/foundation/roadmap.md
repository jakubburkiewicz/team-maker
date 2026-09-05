---
project: "team-maker"
version: 1
status: draft
created: 2026-08-30
updated: 2026-09-05
prd_version: 1
main_goal: low-complexity
top_blocker: time
milestone_id: visible-rule-team-crud
milestone_seq: 1
milestone_status: open
---

# Mapa drogowa: team-maker

> Wywiedziono z `context/foundation/prd.md` (v1) + zinwentaryzowanej bazy kodu.
> Edytuj na miejscu; archiwizuj, gdy zostanie zastąpiona.
> Poniższe fragmenty są wymienione w kolejności zależności. Tabela "W skrócie" jest indeksem.

## Kamień milowy

**M-1: Widoczna reguła domenowa i pełna pętla CRUD nad drużyną** — Status: otwarty

- **Cel:** Osoba bez znajomości mechaniki zakłada konto, kompletuje drużynę spełniającą próg
  siedmiu kompetencji, zapisuje ją, a następnie wykonuje na niej wszystkie cztery operacje
  CRUD — przy czym żadna ścieżka nie ujawnia drużyny innego konta.
- **Materiały źródłowe:** `context/foundation/prd.md` (v1)
- **Gotowe, gdy:** każdy F-NN i S-NN poniżej jest `done`.
- **Kotwice zakresu:** FR-004 – FR-019, US-01 – US-04, `## Business Logic`, `## Access Control`,
  oraz Guardraile z `## Success Criteria`.
  - **Poza zakresem tego kamienia milowego, bo już dowiezione:** FR-001, FR-002, FR-003
    (rejestracja z potwierdzeniem adresu, logowanie, wylogowanie) — działają w bazie kodu,
    patrz `## Baza`. Nie mają fragmentu, bo nie ma czego budować.

## Podsumowanie wizji

team-maker to pojedynczy ekran wyjęty z gry cyberpunkowej, która nie powstaje: gracz kompletuje
drużynę z zamkniętej puli postaci tak, by każda z siedmiu kompetencji zebrała co najmniej dwa
punkty. Osobą, pod którą optymalizujemy, nie jest gracz, lecz recenzent, który wchodzi raz, bez
kontekstu fabularnego, i w kilka minut ma zobaczyć działający CRUD oraz nietrywialną regułę
domenową. Wartością nie jest rozwiązanie łamigłówki, tylko to, że reguła jest widoczna na ekranie,
a domknięty skład zostaje trwale zapisany — więc każda decyzja zakresowa idzie w stronę
uproszczenia, nie rozbudowy.

## Gwiazda przewodnia

**S-03: Gracz zapisuje skompletowaną drużynę i dostaje potwierdzenie** — łączy widoczną regułę
domenową z trwałym zapisem, czyli dokładnie dwie rzeczy, które Wizja nazywa jedyną wartością
projektu; dopóki ten fragment nie działa, reszta pętli CRUD nie ma nad czym pracować.

> Gwiazda przewodnia to najmniejszy kompletny przepływ od interfejsu przez logikę po zapis,
> którego udane dowiezienie potwierdza, że produkt w ogóle działa. Umieszczam ją tak wcześnie,
> jak pozwalają jej wymagania wstępne, bo wszystko inne ma znaczenie dopiero wtedy, gdy ona działa.

## W skrócie

| ID   | Change ID                        | Wynik (użytkownik może …)                                                | Wymagania wstępne | Odnośniki PRD                                    | Status   |
| ---- | -------------------------------- | ------------------------------------------------------------------------ | ----------------- | ------------------------------------------------ | -------- |
| F-01 | `domain-rule-verification-harness` | (fundament) reguła domenowa da się wykonać i sprawdzić poza przeglądarką | —                 | Business Logic, Guardrails                       | done |
| F-02 | `solvable-character-pool`          | (fundament) zamknięta pula postaci i perków istnieje i jest rozwiązywalna | F-01              | Business Logic, FR-012, FR-013, FR-014           | done |
| S-01 | `team-roster-composition`          | dobrać do sześciu różnych postaci i zobaczyć swój skład                   | F-02              | US-01, FR-006, FR-012, FR-013, FR-015            | planning |
| S-02 | `competency-radar-gate`            | wybrać perki i zobaczyć na wykresie werdykt progu                         | S-01              | US-01, FR-014, FR-016, FR-018                    | proposed |
| S-03 | `first-saved-team`                 | zapisać domkniętą drużynę i zobaczyć potwierdzenie zapisu                 | S-02              | US-01, FR-007, FR-011, FR-018, FR-019            | proposed |
| S-04 | `own-teams-list-and-detail`        | zobaczyć listę wyłącznie własnych drużyn i otworzyć jedną z nich          | S-03              | US-01, FR-004, FR-005, FR-008                    | proposed |
| S-05 | `edit-saved-team`                  | zmienić skład zapisanej drużyny i zapisać zmiany                          | S-04              | US-02, FR-009, FR-018                            | proposed |
| S-06 | `delete-team-confirmed`            | usunąć własną drużynę po potwierdzeniu w oknie dialogowym                 | S-04              | US-03, FR-010                                    | proposed |
| S-07 | `cross-account-team-isolation`     | mieć pewność, że cudza drużyna jest niedostępna każdą ścieżką             | S-05, S-06        | US-04, FR-004                                    | proposed |
| S-08 | `missing-points-counter`           | zobaczyć, ilu punktów brakuje w każdej kompetencji poniżej progu          | S-02              | FR-017                                           | proposed |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które współdzielą łańcuch Wymagań wstępnych. Kanoniczna
kolejność nadal znajduje się w grafie zależności poniżej; ta tabela to proponowana kolejność
czytania w równoległych ścieżkach.

| Strumień | Temat                        | Łańcuch                                            | Uwaga                                                                                                              |
| -------- | ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A        | Widoczna reguła domenowa     | `F-01` → `F-02` → `S-01` → `S-02` → `S-03`         | Ścieżka do gwiazdy przewodniej. Najkrótsza droga do dowodu, że produkt działa — zgodnie z celem `low-complexity`.   |
| B        | Pętla CRUD nad zapisaną drużyną | `S-04` → `S-05` → `S-06` → `S-07`               | Odgałęzia się od strumienia A w `S-03`. `S-05` i `S-06` można prowadzić równolegle; `S-07` domyka je oba.           |
| C        | Czytelność łamigłówki        | `S-08`                                             | Odgałęzia się od strumienia A w `S-02`. Jedyny fragment o priorytecie „miły dodatek" — pierwszy kandydat do cięcia. |

## Baza

Co już jest na miejscu w bazie kodu na dzień `2026-08-30` (zinwentaryzowane + potwierdzone przez
użytkownika). Poniższe fundamenty zakładają, że te elementy są obecne i NIE tworzą ich ponownie.

- **Frontend:** obecny — Astro 6 SSR z wyspami React 19 i Tailwind 4; szkielet komponentów
  w `src/components/ui/`, wspólny `src/layouts/Layout.astro`. Zero interfejsu domenowego
  (brak ekranów drużyn, postaci i wykresu).
- **Backend / API:** częściowy — istnieją wyłącznie trasy uwierzytelniania
  (`src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`). Brak jakiejkolwiek trasy domenowej.
- **Dane:** nieobecny — `supabase/` zawiera wyłącznie `config.toml`; zero migracji, zero
  wygenerowanych typów bazy, zero odwołań do tabel w `src/`.
- **Uwierzytelnianie:** obecny — klient sesyjny w `src/lib/supabase.ts`, ochrona tras
  w `src/middleware.ts` (lista `PROTECTED_ROUTES`), komplet ekranów rejestracji, logowania,
  wylogowania i `/auth/confirm-email`. Potwierdzanie adresu włączone w produkcji.
  **Pokrywa FR-001, FR-002, FR-003 w całości.** FR-004 pokryty tylko częściowo: middleware chroni
  dziś jedną trasę, a każda nowa trasa musi zostać do tej listy dopisana.
- **Wdrożenie / infrastruktura:** obecny — Cloudflare Workers ze static assets
  (`wrangler.jsonc`), status `deployed-and-verified` wg `context/deployment/deploy-plan.md`.
  CI w `.github/workflows/ci.yml` uruchamia synchronizację typów, lint i build; nie wdraża.
- **Obserwowalność:** częściowy — obserwowalność platformy włączona w `wrangler.jsonc` (logi
  i podgląd na żywo). Brak biblioteki logowania lub śledzenia błędów w kodzie. Żadne wymaganie
  pozafunkcjonalne PRD tego nie wymaga, więc nie powstaje z tego fundament.
- **Testy:** nieobecny — w manifeście pakietu nie ma żadnego uruchamiacza testów. To jedyna luka
  bazowa, którą PRD nazywa wprost wiążącą (`## Business Logic`: warunek rozwiązywalności puli
  „podlega weryfikacji testem").

## Fundamenty

### F-01: Wykonywalna weryfikacja reguły domenowej

- **Wynik:** (fundament) regułę siedmiu kompetencji da się wykonać i sprawdzić poza przeglądarką,
  jednym uruchomieniem, na dowolnym składzie podanym jako dane wejściowe.
- **Change ID:** `domain-rule-verification-harness`
- **Odnośniki PRD:** `## Business Logic` („podlega weryfikacji testem"), Guardrail „zapisana
  drużyna zawsze spełnia próg", Guardrail „izolacja danych między kontami", `## Vision` (testy
  jako jeden z czterech warunków oceny)
- **Odblokowuje:** F-02 (weryfikacja rozwiązywalności puli — bez tego warunek danych początkowych
  pozostaje deklaracją), S-03 (dowód, że progu nie da się obejść poza interfejsem),
  S-07 (dowód izolacji na dwóch kontach)
- **Wymagania wstępne:** —
- **Równolegle z:** —
- **Blokery:** —
- **Niewiadome:** — (rozstrzygnięte 2026-08-30: wyłącznie czysta reguła domenowa, bez bazy,
  trasy API i dwóch kont — patrz `context/changes/domain-rule-verification-harness/change.md`)
- **Ryzyko:** Sekwencjonowane jako pierwsze, bo trzy późniejsze pozycje opierają na nim swój dowód,
  a dorabianie weryfikacji po fakcie zwykle kończy się jej pominięciem. Ryzyko przeciwne jest realne:
  `AGENTS.md` odnotowuje brak uruchamiacza testów jako stan świadomy, więc ten fundament dokłada
  pierwszą nową zależność do projektu — musi zostać najmniejszy, jaki wystarczy, inaczej zjada
  okno czasowe, które jest głównym ryzykiem kamienia milowego.
- **Status:** done

### F-02: Rozwiązywalna pula postaci i perków

- **Wynik:** (fundament) zamknięta pula 10–12 postaci — każda ze specjalizacją i trzema perkami —
  jest dostępna dla aplikacji, a istnienie co najmniej jednego składu domykającego próg zostało
  potwierdzone weryfikacją, nie założeniem.
- **Change ID:** `solvable-character-pool`
- **Odnośniki PRD:** `## Business Logic` („Warunek poprawności puli postaci (wiążący)"),
  FR-012, FR-013, FR-014, Non-Goal „tworzenie własnych postaci przez gracza"
- **Odblokowuje:** S-01 (bez puli nie ma z czego kompletować składu), S-02 (bez specjalizacji
  i perków wykres nie ma czego sumować), oraz ścieżkę weryfikacji „istnieje co najmniej jedno
  rozwiązanie domykające próg" z F-01
- **Wymagania wstępne:** F-01
- **Równolegle z:** —
- **Blokery:** —
- **Niewiadome:**
  - Czy pula ma być danymi w bazie, czy stałą w kodzie? — **Rozstrzygnięte (2026-08-30, sesja
    planowania):** w bazie, decyzją użytkownika wbrew rekomendacji planu. Autorskim źródłem prawdy
    pozostaje stała `CHARACTER_POOL` w `src/lib/domain/character-pool.ts`, z której generowana jest
    migracja zasiewowa; test zgodności pilnuje, żeby obie reprezentacje były identyczne.
  - Kto redaguje treść postaci — nazwy, opisy, przypisanie perków do kompetencji? —
    **Rozstrzygnięte (2026-09-05):** treść wygenerował agent, po angielsku (spójnie z językiem
    interfejsu); użytkownik przeczytał i zaakceptował przed migracją.
- **Ryzyko:** Sekwencjonowane przed jakąkolwiek pracą widoczną dla użytkownika, bo pula jest
  wejściem każdego kolejnego fragmentu, a jej dobór jest wiążącym warunkiem poprawności, nie
  kwestią smaku: sześć postaci wnosi najwyżej sześć specjalizacji przy siedmiu kompetencjach,
  więc pula dobrana na oko może uczynić łamigłówkę nierozwiązywalną. Pierwotne założenie
  „fundament nie buduje warstwy danych" przestało obowiązywać decyzją użytkownika z sesji
  planowania: F-02 dostarcza pierwszą migrację projektu (enum `competency`, tabele `characters`
  i `perks`, RLS wyłącznie do odczytu) oraz odczyt `getCharacterPool` w `src/lib/character-pool-repo.ts`.
  Przegląd implementacji 2026-09-05 (`ZAAKCEPTOWANO`, 0 krytycznych) dołożył trzecią migrację —
  `20260905090700_character_pool_revoke_writes.sql`, obrona w głąb cofająca przywileje zapisu
  rolom `anon`/`authenticated` na poziomie `GRANT` — oraz konwencję w `AGENTS.md`: moduły danych
  w `src/lib/` rzucają `Error`, strony i trasy API łapią. Zapis decyzji:
  `context/changes/solvable-character-pool/reviews/impl-review.md`.
- **Status:** done

## Fragmenty

### S-01: Gracz dobiera skład drużyny z puli postaci

- **Wynik:** Gracz może rozpocząć kompletowanie nowej drużyny, otworzyć okno wyboru członka
  z listą postaci po lewej i szczegółami wybranej po prawej, dodać do sześciu różnych postaci,
  usunąć członka i przez cały czas widzieć aktualny skład.
- **Change ID:** `team-roster-composition`
- **Odnośniki PRD:** US-01, FR-006, FR-012, FR-013, FR-015
- **Wymagania wstępne:** F-02
- **Równolegle z:** —
- **Blokery:** —
- **Niewiadome:**
  - Czy kompletowana drużyna przeżywa odświeżenie strony, czy żyje wyłącznie w sesji przeglądarki? — Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** Pierwszy fragment widoczny dla użytkownika i najtańszy sposób, żeby pula z F-02
  spotkała się z prawdziwym interfejsem. Ryzyko: limity „maksimum sześciu członków" i „brak
  powtórzeń" są Guardrailem, więc muszą być egzekwowane, a nie tylko ukryte w interfejsie —
  fragment, który je tylko chowa, wygląda na gotowy i nim nie jest.
- **Status:** planning

### S-02: Gracz wybiera perki i widzi wykres kompetencji z werdyktem progu

- **Wynik:** Gracz może wybrać maksymalnie dwa z trzech perków każdego członka i widzi wykres
  pajęczynowy siedmiu kompetencji przeliczany po każdej zmianie, wraz z przyciskiem „Wyrusz na
  zlecenie", który pozostaje zablokowany z komunikatem ogólnym, dopóki którakolwiek kompetencja
  ma mniej niż dwa punkty.
- **Change ID:** `competency-radar-gate`
- **Odnośniki PRD:** US-01, FR-014, FR-016, FR-018, wymaganie pozafunkcjonalne „poniżej 200 ms
  od wyboru", Guardrail „wykres zawsze zgodny ze składem"
- **Wymagania wstępne:** S-01
- **Równolegle z:** —
- **Blokery:** —
- **Niewiadome:**
  - Jak narysować wykres pajęczynowy bez dokładania ciężkiej zależności? — Właściciel: TBD (rozstrzyga `/10x-plan`). Blok: nie.
- **Ryzyko:** To jedyny fragment, który czyni regułę domenową widoczną, i PRD nazywa go najdroższym
  elementem interfejsu w całym MVP — przy głównym ryzyku „czas" to on najłatwiej rozjedzie się
  z oknem czasowym. Sekwencjonowany zaraz po składzie, bo blokada przycisku z FR-018 jest warunkiem
  wstępnym zapisu, a nie jego ozdobą.
- **Status:** proposed

### S-03: Gracz zapisuje skompletowaną drużynę i dostaje potwierdzenie

- **Wynik:** Gracz może użyć przycisku „Wyrusz na zlecenie" na składzie domykającym próg i zobaczyć
  komunikat, który najpierw wprost potwierdza zapis drużyny pod automatycznie wygenerowaną
  nazwą-hashem, a dopiero potem informuje „Work in Progress".
- **Change ID:** `first-saved-team`
- **Odnośniki PRD:** US-01, FR-007, FR-011, FR-018, FR-019, Guardrail „zapisana drużyna zawsze
  spełnia próg", Non-Goal „wersje robocze niedomkniętych drużyn"
- **Wymagania wstępne:** S-02
- **Równolegle z:** S-08
- **Blokery:** —
- **Niewiadome:**
  - Z czego liczony jest hash nazwy i czy musi być unikalny w obrębie konta? — Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** Gwiazda przewodnia — dopiero tu powstaje trwały zapis, a wraz z nim odcięcie cudzych
  drużyn na poziomie dostępu do danych, bo tabela bez tego odcięcia jest dziurą od pierwszej minuty
  jej istnienia. Główne ryzyko fragmentu: próg egzekwowany wyłącznie w przeglądarce łamie Guardrail
  „reguła obowiązuje także poza interfejsem" — weryfikacja z F-01 jest tu jedynym dowodem, że tak
  nie jest. Warsztat bazy już istnieje po F-02: katalog `supabase/migrations/` z pierwszymi
  migracjami, wzorzec RLS (`enable row level security` + wyłącznie polityki, których fragment
  potrzebuje), lokalny obieg `supabase start` / `supabase db reset` oraz `supabase db push` na
  zlinkowany projekt hostowany. Klucz obcy z `teams` do `characters(id)` jest przewidziany —
  zasiew puli działa upsertem, bez `delete`.
- **Status:** proposed

### S-04: Gracz widzi listę własnych drużyn i otwiera zapisaną drużynę

- **Wynik:** Gracz może zobaczyć listę wyłącznie własnych zapisanych drużyn — a przy braku
  jakiejkolwiek drużyny wyjaśnienie i wezwanie do utworzenia pierwszej, nie zero wyników — oraz
  otworzyć wybraną drużynę i zobaczyć jej skład, perki i wykres kompetencji.
- **Change ID:** `own-teams-list-and-detail`
- **Odnośniki PRD:** US-01 (kryterium akceptacji stanu pustego), FR-004, FR-005, FR-008
- **Wymagania wstępne:** S-03
- **Równolegle z:** S-08
- **Blokery:** —
- **Niewiadome:**
  - Czy widok szczegółów startuje w trybie tylko do odczytu, czy od razu w trybie kompletowania? — Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** Domyka odczyt w pętli CRUD i jest miejscem, w którym każda nowa trasa musi trafić do
  listy tras chronionych — inaczej FR-004 zostaje spełniony tylko dla ekranów, które istniały
  wcześniej. Fragment ponownie używa widoku kompletowania zgodnie z rozstrzygnięciem FR-008, więc
  ryzykiem jest rozjechanie się dwóch trybów tego samego ekranu, a nie koszt budowy.
- **Status:** proposed

### S-05: Gracz zmienia skład zapisanej drużyny

- **Wynik:** Gracz może otworzyć zapisaną drużynę, wymienić członka lub zmienić jego perki
  i zapisać zmiany — przy czym zapis jest możliwy wyłącznie wtedy, gdy skład nadal domyka próg,
  a nazwa-hash pozostaje niezmieniona i nieedytowalna.
- **Change ID:** `edit-saved-team`
- **Odnośniki PRD:** US-02, FR-009, FR-018, FR-011, Non-Goal „edycja nazwy drużyny"
- **Wymagania wstępne:** S-04
- **Równolegle z:** S-06, S-08
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** Ten sam próg co przy tworzeniu, ale w odwrotną stronę: usunięcie członka musi
  ponownie zablokować zapis. Fragment, który sprawdza próg tylko przy pierwszym zapisie, przepuszcza
  drużynę poniżej progu przez edycję i łamie Guardrail tylnymi drzwiami. Prowadzony równolegle
  z usuwaniem, bo obie ścieżki wchodzą do tego samego rekordu, ale się nie przecinają.
- **Status:** proposed

### S-06: Gracz usuwa własną drużynę po potwierdzeniu

- **Wynik:** Gracz może usunąć własną drużynę po potwierdzeniu w oknie dialogowym; rezygnacja
  zostawia drużynę nietkniętą, a usunięcie ostatniej drużyny przywraca stan pusty z wezwaniem
  do utworzenia nowej.
- **Change ID:** `delete-team-confirmed`
- **Odnośniki PRD:** US-03, FR-010, Non-Goal „kosz i przywracanie usuniętych drużyn"
- **Wymagania wstępne:** S-04
- **Równolegle z:** S-05, S-08
- **Blokery:** —
- **Niewiadome:** —
- **Ryzyko:** Operacja nieodwracalna, której jedyną ochroną jest okno potwierdzenia — pominięcie
  tego okna nie ma ścieżki naprawczej. Domyka ostatnią z czterech operacji CRUD, więc to on
  decyduje, czy pierwsze Kryterium sukcesu jest spełnione w całości.
- **Status:** proposed

### S-07: Cudza drużyna jest niedostępna każdą ścieżką

- **Wynik:** Gracz zalogowany na jednym koncie nie może otworzyć, zmienić ani usunąć drużyny
  należącej do innego konta — także przez bezpośredni adres z odgadniętym identyfikatorem —
  a próba nie ujawnia ani nie zmienia cudzych danych.
- **Change ID:** `cross-account-team-isolation`
- **Odnośniki PRD:** US-04, FR-004, Guardrail „izolacja danych między kontami", wymaganie
  pozafunkcjonalne „liczba drużyn cudzego konta widocznych lub modyfikowalnych wynosi zero"
- **Wymagania wstępne:** S-05, S-06
- **Równolegle z:** S-08
- **Blokery:** —
- **Niewiadome:**
  - Czy odgadnięty identyfikator ma zwracać odpowiedź „nie znaleziono", czy przekierowanie na listę? — Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** Sekwencjonowany na końcu pętli CRUD celowo: dopiero gdy istnieją wszystkie cztery
  operacje, da się wykazać zero na wszystkich czterech, a nie tylko na odczycie. Wymaganie jest
  własnością binarną — jedna nieosłonięta trasa unieważnia cały fragment — więc jego dowodem jest
  weryfikacja na dwóch kontach z F-01, nie inspekcja kodu.
- **Status:** proposed

### S-08: Gracz widzi listę brakujących punktów

- **Wynik:** Gracz widzi obok wykresu listę kompetencji poniżej progu wraz z liczbą punktów
  brakujących w każdej z nich.
- **Change ID:** `missing-points-counter`
- **Odnośniki PRD:** FR-017 (priorytet: miły dodatek), `## Success Criteria` → Secondary
- **Wymagania wstępne:** S-02
- **Równolegle z:** S-03, S-04, S-05, S-06, S-07
- **Blokery:** —
- **Niewiadome:**
  - Czy przy głównym ryzyku „czas" ten fragment zostaje w kamieniu milowym? — Właściciel: użytkownik. Blok: nie.
- **Ryzyko:** Jedyny fragment o priorytecie „miły dodatek" i jedyny, którego usunięcie nie narusza
  żadnego Kryterium sukcesu ani Guardraila — a więc pierwszy kandydat do cięcia, gdy okno czasowe
  zacznie się domykać. Rozstrzygnięcie FR-018 zostało celowo osłabione do komunikatu ogólnego
  właśnie po to, żeby zapis nie zależał od tego fragmentu.
- **Status:** proposed

## Przekazanie do backlogu

| Identyfikator mapy drogowej | Identyfikator zmiany               | Sugerowany tytuł problemu                                       | Gotowe do `/10x-plan` | Uwagi                                        |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------- | --------------------- | -------------------------------------------- |
| F-01                        | `domain-rule-verification-harness` | Wykonywalna weryfikacja reguły siedmiu kompetencji               | —                     | Done 2026-08-30 (`impl_reviewed`)             |
| F-02                        | `solvable-character-pool`          | Rozwiązywalna pula 10–12 postaci wraz z perkami                  | —                     | Done 2026-09-05 (`impl_reviewed`)             |
| S-01                        | `team-roster-composition`          | Kompletowanie składu z okna wyboru członka                       | yes                   | Uruchom `/10x-plan team-roster-composition`   |
| S-02                        | `competency-radar-gate`            | Wybór perków, wykres pajęczynowy i blokada progu                 | no                    | Czeka na S-01                                 |
| S-03                        | `first-saved-team`                 | Zapis domkniętej drużyny z potwierdzeniem                        | no                    | Gwiazda przewodnia. Czeka na S-02             |
| S-04                        | `own-teams-list-and-detail`        | Lista własnych drużyn ze stanem pustym i widok szczegółów        | no                    | Czeka na S-03                                 |
| S-05                        | `edit-saved-team`                  | Edycja składu zapisanej drużyny pod tym samym progiem            | no                    | Czeka na S-04                                 |
| S-06                        | `delete-team-confirmed`            | Usuwanie drużyny z oknem potwierdzenia                           | no                    | Czeka na S-04. Równolegle z S-05              |
| S-07                        | `cross-account-team-isolation`     | Odcięcie cudzych drużyn na wszystkich czterech operacjach        | no                    | Czeka na S-05 i S-06                          |
| S-08                        | `missing-points-counter`           | Licznik brakujących punktów obok wykresu                         | no                    | Czeka na S-02. Priorytet „miły dodatek"       |

## Otwarte pytania dotyczące mapy drogowej

1. **Czy S-08 (licznik brakujących punktów, FR-017) zostaje w zakresie tego kamienia milowego?**
   Przy głównym ryzyku `time` i celu `low-complexity` jest to jedyna pozycja, której cięcie nie
   narusza żadnego Kryterium sukcesu ani Guardraila. — Właściciel: użytkownik. Blokuje: S-08.
2. ~~**Jak daleko ma sięgać wykonywalna weryfikacja z F-01?**~~ — **rozstrzygnięte 2026-08-30**:
   wyłącznie czysta reguła domenowa (Vitest nad `src/lib/domain/`), bez bazy danych, trasy API
   i weryfikacji dwóch kont. Szerszy zakres wchodzi z S-03 (próg poza interfejsem) i S-07
   (izolacja kont). Zapis decyzji: `context/changes/domain-rule-verification-harness/change.md`.

## Zaparkowane

- **Rozgrywka i wykonywanie zleceń** — Dlaczego zaparkowane: PRD §Non-Goals; „Wyrusz na zlecenie"
  kończy się komunikatem „Work in Progress", misje i walka są jawną granicą projektu.
- **Edycja nazwy drużyny** — Dlaczego zaparkowane: PRD §Non-Goals; nazwa-hash jest nadawana
  automatycznie i niezmienna (FR-011).
- **Edycja danych postaci poza wyborem perków** — Dlaczego zaparkowane: PRD §Non-Goals;
  specjalizacje, opisy i zestawy perków są stałe.
- **Tworzenie własnych postaci przez gracza** — Dlaczego zaparkowane: PRD §Non-Goals; pula jest
  globalna i zamknięta, co jest też warunkiem rozwiązywalności z F-02.
- **Reset i odzyskiwanie hasła** — Dlaczego zaparkowane: PRD §Non-Goals; świadomie przyjęte ryzyko
  przy rozstrzygnięciu FR-002.
- **Wersje robocze niedomkniętych drużyn** — Dlaczego zaparkowane: PRD §Non-Goals; łamałyby
  Guardrail „zapisana drużyna zawsze spełnia próg".
- **Kosz i przywracanie usuniętych drużyn** — Dlaczego zaparkowane: PRD §Non-Goals; okno
  potwierdzenia z S-06 jest jedyną ochroną.
- **Współdzielenie drużyn, role i panel administratora** — Dlaczego zaparkowane: PRD §Non-Goals;
  model dostępu pozostaje płaski.
- **Podpowiedź, która postać lub perk domyka brakującą kompetencję** — Dlaczego zaparkowane:
  PRD §Non-Goals; rozważone jako FR-020 i odrzucone jako najdroższy element logiki w całym MVP.
- **Obsługa urządzeń mobilnych** — Dlaczego zaparkowane: PRD §Non-Goals; układ dwukolumnowy
  z FR-013 zakłada szeroki ekran.
- **Tryb offline** — Dlaczego zaparkowane: PRD §Non-Goals; aplikacja wymaga połączenia.
- **Zgodność z WCAG-AA** — Dlaczego zaparkowane: PRD §Non-Goals; wykres pajęczynowy z S-02 jest
  tu najsłabszym punktem i pozostaje bez audytu.
- **Wielojęzyczność** — Dlaczego zaparkowane: PRD §Non-Goals; jeden język interfejsu.
- **Automatyczne wdrożenie po scaleniu** — Dlaczego zaparkowane: ujawnione przy inwentaryzacji bazy
  (CI uruchamia dziś lint i build, nie wdraża). Żadne wymaganie PRD tego nie wymaga, a wdrożenie
  ręczne jest już zweryfikowane — przy głównym ryzyku `time` to koszt bez punktów.
- **Śledzenie błędów i logowanie w kodzie** — Dlaczego zaparkowane: ujawnione przy inwentaryzacji
  bazy. Obserwowalność platformy wystarcza przy tej skali; żadne wymaganie pozafunkcjonalne PRD
  nie żąda instrumentacji.

## Historia kamieni milowych

(Pusta — M-1 jest pierwszym kamieniem milowym tego projektu.)

## Zrobione

- **F-01: (fundament) regułę siedmiu kompetencji da się wykonać i sprawdzić poza przeglądarką,
  jednym uruchomieniem, na dowolnym składzie podanym jako dane wejściowe** — Zarchiwizowano
  2026-08-30 → `context/archive/2026-08-30-domain-rule-verification-harness/`. Lekcja: —.
- **F-02: (fundament) zamknięta pula 10–12 postaci — każda ze specjalizacją i trzema perkami —
  jest dostępna dla aplikacji, a istnienie co najmniej jednego składu domykającego próg zostało
  potwierdzone weryfikacją, nie założeniem** — Zarchiwizowano 2026-09-05 →
  `context/archive/2026-08-30-solvable-character-pool/`. Lekcja: —.
