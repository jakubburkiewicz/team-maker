<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Rozwiązywalna pula 10–12 postaci wraz z perkami

- **Plan**: context/changes/solvable-character-pool/plan.md
- **Zakres**: Fazy 1–4 z 4 (pełny przegląd planu)
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANO
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 7 obserwacji

## Werdykty

| Wymiar                  | Werdykt |
| ----------------------- | ------- |
| Zgodność z planem       | PASS    |
| Dyscyplina zakresu      | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura            | PASS    |
| Spójność wzorców        | PASS    |
| Kryteria sukcesu        | PASS    |

## Kryteria sukcesu — dowody

Automatyczne (uruchomione 2026-09-05 pod Node 22.14.0):

- `npm test` — 5 plików, 37 testów, zielone; czas 301 ms (< 5 s) ✅
- `npm run lint` — bez błędów ✅
- `npx astro sync && npm run build` — zielone ✅
- `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/` — brak dopasowań ✅
- `grep -rl "lib/supabase" --include='*.test.ts' src` — brak dopasowań ✅

Ręczne: wszystkie 17 pozycji oznaczone `[x]` z SHA. Dowody w diffie istnieją dla 4.5 (deploy-plan.md:141-148) i 4.6 (roadmap.md F-02/S-03). Pozycje mutacyjne (1.6, 1.7, 2.9) i stosu lokalnego/produkcyjnego (2.5–2.8, 3.5–3.6, 4.1–4.4) z natury nie zostawiają śladu w diffie — przyjęte na podstawie deklaracji; niezależna sonda przeglądu potwierdziła, że solver zgadza się z brute-force przez `evaluateTeam` (893 296 = 893 296 na 8-postaciowej podpuli).

Nieplanowane zmiany w diffie: `AGENTS.md` (p4, 1 linia — doprecyzowanie zakazu `config push` po zlinkowaniu), `roadmap.md` w p1 (status F-02 → in-progress). Brak elementów MISSING.

## Ustalenia

### F1 — Komentarz upsertu obiecuje „bez delete” dla każdej korekty, a usunięcie postaci zderzy się z `sort_order`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/domain/character-pool-sql.ts:29-31
- **Szczegóły**: Komentarz mówi, że `on conflict (id) do update` „obsługuje pierwszy zasiew i każdą późniejszą korektę treści tym samym tekstem, bez `delete`”. To prawda dla edycji treści i zmiany kolejności (odroczone unikalności działają), ale nie dla usunięcia postaci lub perka: usunięcie np. `halloran` (indeks 5) z `CHARACTER_POOL` nadaje `ghostline` `sort_order = 5`, a stary wiersz `halloran` nadal trzyma `5` — `characters_sort_order_key` wybucha przy `commit`. Sam plan („Uwagi dotyczące migracji”) przewiduje „plus jawne `delete` wyłącznie dla identyfikatorów usuniętych z puli”; komentarz w kodzie tego nie mówi, a to on będzie czytany przy następnej migracji zasiewowej.
- **Poprawka**: Doprecyzuj komentarz — upsert pokrywa dodanie, edycję i zmianę kolejności; usunięcie wymaga w nowej migracji zasiewowej jawnego `delete from public.perks/characters where id not in (...)` **przed** blokiem upsertu (inaczej unikalność `sort_order` wybucha przy commit), zgodnie z planem.
- **Decyzja**: FIXED — komentarz przeredagowany

### F2 — Pusta pula z bazy przechodzi bez błędu, choć nigdy nie jest stanem legalnym

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/character-pool-repo.ts:91-93
- **Szczegóły**: `getCharacterPool` rzuca przy błędzie zapytania (zgodnie z planem), ale `data = []` przepuszcza jako poprawną pustą pulę. Pusta pula nie jest nigdy stanem legalnym — 12 postaci jest zasianych migracją — więc oznacza wywołanie jako `anon` (RLS → 0 wierszy, bez błędu), niezastosowany seed albo błędny select. Komentarz w liniach 75–76 sam zauważa, że „pusta pula wygląda w interfejsie identycznie jak awaria bazy”, ale wywołujący nie dostaje żadnego sygnału, by je rozróżnić.
- **Poprawka A ⭐ Zalecane**: Rzucaj `Error` przy `rows.length === 0` („Character pool is empty — RLS/seed misconfiguration?”).
  - Siła: Jedna linia; nieprotegowana trasa albo brak seedu ujawnia się głośno zamiast pustym oknem wyboru u recenzenta.
  - Kompromis: Repo zaczyna zakładać stan zasiewu — test czystej części nie obejmie tej gałęzi bez stuba klienta.
  - Pewność: WYSOKA — pusta pula nie ma żadnego legalnego źródła w tym projekcie.
  - Martwy punkt: Nie sprawdzono, jak S-01 zamierza obsłużyć stan błędu strony.
- **Poprawka B**: Zostaw repo jak jest; S-01 traktuje pustą listę jako stan błędu w interfejsie.
  - Siła: Repo pozostaje cienkie i neutralne wobec danych.
  - Kompromis: Decyzja odkłada się do S-01 i łatwo o niej zapomnieć — pusta lista wygląda jak „brak wyników”.
  - Pewność: ŚREDNIA — zależy od dyscypliny w S-01.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED via Fix A — `getCharacterPool` rzuca przy pustej odpowiedzi

### F3 — Próg kalibracji o sześć rzędów wielkości wyżej niż zapowiadał plan

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/lib/domain/character-pool.test.ts:123-128
- **Szczegóły**: Plan (plan.md:232-234) mówił o progu „rzędu dziesiątek rozwiązań”; test asertuje `> 10_000_000` przy zmierzonej bazie 16 329 329. Plan opisał zły rząd wielkości — licznik liczy wszystkie pary (podzbiór, przypisanie perków) łącznie z nadzbiorami, więc wynik jest z natury milionowy, a „dziesiątki” nie wiązałyby niczego. Próg 10 mln spełnia intencję: zmiana kompetencji dowolnego pojedynczego perka zostawia ≥ 14,4 mln (zielone), utrata jedynej specjalizacji `negotiation` spada do 8,3 mln (czerwone). Wada planu, nie kodu.
- **Poprawka**: Dopisz w planie przy pozycji 4 Fazy 1 notę: rząd „dziesiątki” był błędny; licznik zlicza pary z nadzbiorami, baza 16,3 mln, próg 10 mln.
- **Decyzja**: FIXED — nota korekty dopisana w plan.md

### F4 — Nieaktualny w obrębie tej samej zmiany komentarz o `supabase gen types`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/character-pool-repo.ts:13-14
- **Szczegóły**: Uzasadnienie „`supabase gen types` wymaga zlinkowanego projektu albo Dockera” przestało być prawdą w Fazie 4 tej samej zmiany — `AGENTS.md` mówi teraz, że projekt jest zlinkowany. Zostaje drugi argument („nie ma dziś drugiego konsumenta”). Skutek: `const rows: readonly CharacterRow[] = data` (linia 91) to adnotacja, nie sprawdzenie, a komentarz sugeruje, że nie da się inaczej.
- **Poprawka**: Przeredaguj komentarz: typy bazy nie są generowane, bo pula ma jednego konsumenta i kształt jest strzeżony schematem `not null` plus kontrolą kompetencji w `mapPoolRows`; zlinkowanie już nie jest przeszkodą.
- **Decyzja**: FIXED — komentarz przeredagowany

### F5 — Kolejność puli zależy wyłącznie od nietestowanego `.order()`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/character-pool-repo.ts:57-69
- **Szczegóły**: `mapPoolRows` otrzymuje `sort_order` na obu poziomach, ale nie sortuje — komentarz (linia 55) deleguje porządek do `.order()` w `getCharacterPool`, którego żaden test nie obejmuje. Gwarancja deterministycznej kolejności (FR-013, FR-014) stoi na jednym, niesprawdzanym wywołaniu.
- **Poprawka**: Sortuj po `sort_order` w `mapPoolRows` (12 wierszy, koszt zerowy) i dodaj przypadek „wiersze w losowej kolejności wychodzą posortowane” — gwarancja przenosi się do testu czystego.
- **Decyzja**: FIXED — `bySortOrder` w `mapPoolRows` + przypadek testowy (8/8 zielone)

### F6 — Jedyną barierą zapisu jest RLS; uzasadnienie w migracji odwrócone

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: supabase/migrations/20260905081500_character_pool_schema.sql:8-10
- **Szczegóły**: Polityki są poprawne (jawne `to authenticated`, tylko `select`, zero polityk zapisu; `anon` → 0 wierszy). Dwie uwagi: (1) komentarz uzasadnia brak dostępu `anon` przez FR-004, a PRD sam mówi, że przekierowanie „samo w sobie niczego nie chroni” — mechanizmem jest domyślna odmowa RLS bez polityki; (2) Supabase nadaje `anon` i `authenticated` wszystkie przywileje tabelowe na nowych tabelach w `public`, więc RLS jest jedyną barierą przed zapisem. Migracja jest już zastosowana na produkcji — jest niezmienna, także w komentarzach.
- **Poprawka**: Jeśli chcesz obrony w głąb — nowa migracja `revoke insert, update, delete, truncate on public.characters, public.perks from anon, authenticated;`. W przeciwnym razie świadomie pomiń; polityki są wystarczające dla MVP.
- **Decyzja**: FIXED — nowa migracja `20260905090700_character_pool_revoke_writes.sql`; **do zastosowania na produkcji przez `supabase db push`** (nie uruchomione w przeglądzie)

### F7 — `getCharacterPool` rzuca wyjątek — pierwszy taki wzorzec w `src/lib/`, bez zapisu w konwencjach

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Architektura
- **Lokalizacja**: src/lib/character-pool-repo.ts:85-87
- **Szczegóły**: Istniejący kod graniczący z Supabase (`middleware.ts`, `signin.ts`) nigdy nie rzuca — ignoruje błąd albo przekierowuje z `?error=`. Repo jest pierwszym czytnikiem danych i ustanawia wzorzec: kto woła je z `.astro`/API, musi łapać wyjątek, bo niezłapany wyjątek w Workerze to 500. Zgodne z planem („błąd rzucany, nie połykany”), ale nikt tego nie zapisał tam, gdzie S-01 to przeczyta.
- **Poprawka**: Dopisz jedną linię w `AGENTS.md` → Conventions: moduły danych w `src/lib/` rzucają `Error`; strony i trasy API łapią i mapują na `?error=` lub stan strony.
- **Decyzja**: FIXED — konwencja dopisana w AGENTS.md → Conventions

### F8 — Zdublowany helper `combinations` w testach

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/domain/character-pool.test.ts:16-25
- **Szczegóły**: `combinations<T>()` jest skopiowane znak w znak z `evaluate-team.test.ts:23-32`. Współdzielony moduł testowy `test-fixtures.ts` już istnieje, ale plan zakazał jego zmiany („Nie zmieniamy `evaluateTeam` ani `test-fixtures.ts`”) — zakaz dotyczył treści `TEST_POOL`, nie pojawienia się helpera. Powtórzenie jest dziesięcioma liniami; nie utrudnia zmian.
- **Poprawka**: Przenieś helper do `test-fixtures.ts` i importuj w obu zestawach — świadoma, jawna korekta ograniczenia planu. Równie dobra decyzja: pomiń.
- **Decyzja**: SKIPPED — dziesięć linii duplikatu nie uzasadnia ruszania zamkniętego fixture'a

### F9 — Nieplanowane, nieszkodliwe dodatki poza opisem planu

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: supabase/migrations/20260905081500_character_pool_schema.sql:22,32; AGENTS.md:14; src/lib/domain/types.ts:9-13
- **Szczegóły**: (1) `deferrable initially deferred` na obu unikalnościach `sort_order` — plan mówił o zwykłym `unique`; dodatek jest uzasadniony w komentarzu i konieczny dla upsertu zmieniającego kolejność. (2) Linia w `AGENTS.md` o zlinkowaniu i zakazie `config push` — nieujęta w Fazie 4, ale wzmacnia twardą regułę. (3) Przeredagowany komentarz nad `COMPETENCIES` (wartości nietknięte). (4) Dodatkowe przypadki testowe: kebab-case, determinizm renderera, `sort_order` nie przenika, pusta lista. Wszystko w zakresie zmiany i tanie.
- **Poprawka**: Odnotuj `deferrable initially deferred` i wpis `AGENTS.md` w planie jako dodatki (jedna linia każdy), żeby przyszłe przeglądy używały planu jako aktualnej podstawy.
- **Decyzja**: FIXED — dwie noty o dodatkach dopisane w plan.md (Faza 2 poz. 1, Faza 4)
