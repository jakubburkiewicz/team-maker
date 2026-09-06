<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Edycja składu zapisanej drużyny (S-05)

- **Plan**: `context/changes/edit-saved-team/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: DO POPRAWY → **SOLIDNY** (po zastosowaniu wszystkich siedmiu poprawek)
- **Ustalenia**: 1 krytyczne, 5 ostrzeżeń, 1 obserwacja — wszystkie NAPRAWIONE

## Werdykty

| Wymiar | Werdykt (przed) | Po poprawkach |
|---|---|---|
| Zgodność ze stanem końcowym | ZALICZONY | ZALICZONY |
| Oszczędne wykonanie | OSTRZEŻENIE | ZALICZONY |
| Dopasowanie architektoniczne | OSTRZEŻENIE | ZALICZONY |
| Martwe punkty | NIEZALICZONY | ZALICZONY |
| Kompletność planu | OSTRZEŻENIE | ZALICZONY |

## Ugruntowanie

12/12 ścieżek ✓, 8/8 symboli ✓, Progress↔Faza ✓ (1 nagłówek `## Progress`, 3/3 fazy,
zero checkboxów poza sekcją Progress), brief↔plan ⚠️ (F1 — ryzyko F8 obecne w briefie, nieobecne w planie).

Po poprawkach numeracja Progress: faza 1 → 1.1–1.8 (5 auto + 3 ręczne), faza 2 → 2.1–2.9
(6 auto + 3 ręczne), faza 3 → 3.1–3.14 (7 auto + 7 ręcznych). Zweryfikowane mechanicznie.

## Ustalenia

### F1 — Ryzyko klucza omijającego RLS (F8) zniknęło z plan.md

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: brief↔plan; brak w każdej fazie
- **Szczegóły**: `plan-brief.md` zapisuje wprost, że klucz `service_role` omijałby nową politykę
  `update`, więc POST na cudze id faktycznie zmieniłby cudzy wiersz — i oddaje decyzję planowi
  („jeśli ma być przesunięta, to tutaj"). `grep -niE "service_role|SUPABASE_KEY|anon"` na plan.md:
  zero trafień. S-05 jest pierwszym fragmentem dokładającym **zapis** do wiersza wskazanego
  parametrem URL; `updateTeam` nie filtruje po `user_id`, więc cała izolacja stoi na RLS.
  Łamie binarny Guardrail PRD „izolacja danych między kontami".
- **Poprawka A ⭐ Zalecana**: kryterium ręczne w fazie 1 — potwierdzić rodzaj produkcyjnego
  `SUPABASE_KEY`, **zanim faza 2 wypuści trasę zapisu**.
  - **Korekta po sortowaniu (2026-09-06)**: projekt używa **nowego systemu kluczy Supabase**, nie
    legacy JWT. Właściwy podział to `sb_publishable_` (następca `anon`, RLS **obowiązuje**) kontra
    `sb_secret_` (następca `service_role`, RLS **omijane**). Lokalny `.env` zweryfikowany:
    `sb_publishable_`. Kryterium 1.8 sprawdza sekret **produkcyjny** w Workerze — `wrangler secret
    list` pokazuje wyłącznie nazwy, więc porównanie idzie przez dashboard Supabase albo przez
    ponowne `wrangler secret put`.
  - Siła: jedno sprawdzenie zamyka założenie, na którym stoi kontrola dostępu fragmentu.
  - Kompromis: kryterium ręczne, nie broni się samo w CI.
  - Pewność: WYSOKA — `src/lib/supabase.ts:9` używa jednego klucza dla wszystkich ścieżek.
  - Martwy punkt: nie sprawdzano, czy sekret w Workerze jest tym samym co w `.env`.
- **Poprawka B**: zapisać jako świadomie przyjęte ryzyko, pozostawione S-07.
- **Decyzja**: NAPRAWIONE poprawką A — nowe kryterium ręczne fazy 1 + Progress 1.8, przeredagowane na słownik publishable/secret.

### F2 — Przypadek testowy (3) fazy 2 jest niedookreślony; próg domyka tylko jedna postać

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 → test regresyjny progu edycji
- **Szczegóły**: plan każe wyliczać wejście tylko dla przypadku (2). Uruchomienie na prawdziwej
  puli: rozwiązanie `findThresholdSolution` stawia wszystkie siedem kompetencji **dokładnie** na
  progu, więc po usunięciu `vesper` z sześciu wolnych postaci próg domyka **wyłącznie `marlow`** —
  wzięcie pierwszej wolnej daje czerwień w 5 z 6 przypadków. Dodatkowo `solvedComposition`
  (`team-submission.test.ts:23`) pochodzi z solvera (`solvability.ts:129`), nie z `roster.ts`,
  więc zdanie „skład ma powstawać przez `roster.ts`" jest nieścisłe.
- **Poprawka**: przypadki (2) i (3) wyliczają wejście z puli (kandydat = pierwsza wolna postać,
  dla której `gateTeamSubmission` zwraca `ok: true`); doprecyzowane, że skład startowy pochodzi
  z `findThresholdSolution`, a `roster.ts` wykonuje na nim ruchy.
- **Decyzja**: NAPRAWIONE.

### F3 — `RosterSlot.handlers?` to trzeci przełącznik trybu odczytu, który przeżywa fazę 3

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 3 → `TeamComposer` bez trybu odczytu
- **Szczegóły**: plan sprzedaje fazę 3 jako **likwidację** pary przełączników z `lessons.md`, ale
  tryb odczytu ma trzy nośniki: `readOnly`, brak `client:*` — i **opcjonalność** `handlers`
  w `RosterSlot.tsx:26-35`. Po fazie 3 gałęzie `onRecruit === undefined` (`:52-59`) i perki jako
  `<span>` stają się kodem martwym, a docstring opisuje tryb, którego nie ma. Dokładnie ten kształt
  cichej awarii, przed którym ostrzega lekcja.
- **Poprawka A ⭐ Zalecana**: `handlers: RosterSlotHandlers` wymagany; usunięte obie gałęzie
  i docstring trybu odczytu. `RosterSlot.tsx` dołącza do fazy 3 (cztery pliki, jeden commit).
  - Siła: typ przestaje dopuszczać stan „slot bez akcji" — trzeci przełącznik nie może się rozjechać.
  - Kompromis: faza 3 rośnie z trzech plików do czterech.
  - Pewność: WYSOKA — `RosterSlot` ma jednego konsumenta (`TeamComposer.tsx:112`);
    `MemberPickerDialog` nie zna trybu w ogóle.
  - Martwy punkt: nie sprawdzano, czy S-06/S-07 nie zechcą slotu bez akcji.
- **Poprawka B**: `handlers?` zostaje opcjonalne, poprawka tylko dokumentacji.
- **Decyzja**: NAPRAWIONE poprawką A — nowy pkt 3 w fazie 3 + 5 miejsc towarzyszących
  (przegląd fazy, sekwencjonowanie, kluczowe odkrycia, kryterium 3.7, Progress 3.7).

### F4 — Uzasadnienie wydzielenia `team-composition.ts` przeczy fazie 2 tego samego planu

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 1 → pkt 3 (follow-up F7)
- **Szczegóły**: „Cel" twierdzi, że kształt zyskuje **trzeciego konsumenta — trasę edycji**, ale
  umowa fazy 2 importuje `COMPOSITION_FIELD` i `gateTeamSubmission`, nie `toTeamComposition`.
  Trzeci konsument nie powstaje; liczba importerów po S-05 dalej wynosi 1 (potwierdzone gripem
  po całym repo). Ten sam punkt planu przyznaje to dwa akapity niżej. Test „gdybym to usunął,
  czy stan końcowy nadal osiągalny?" → tak, w całości; to jedyny punkt fazy 1, którego fazy 2 i 3
  nie potrzebują.
- **Poprawka A ⭐ Zalecana**: wyjąć punkt z fazy 1; F7 zostaje follow-upem.
  - Siła: fragment wraca do jednego wątku; mniejszy diff w fazie z migracją, czyli o najwyższym
    koszcie wycofania.
  - Kompromis: dług F7 zostaje.
  - Pewność: WYSOKA — żaden `*.test.ts` nie dotyka `toTeamComposition`, więc refaktor jest równie
    tani później.
  - Martwy punkt: brak — koszt nie rośnie z czasem przy jednym importerze.
- **Poprawka B**: zostawić refaktor, przepisać uzasadnienie na uczciwe.
- **Decyzja**: NAPRAWIONE poprawką A — punkt usunięty, przegląd fazy 1, kryterium i Progress 1.8
  usunięte z renumeracją, wpis w „Czego NIE robimy", kluczowe odkrycia i strategia testowania.

### F5 — Komunikat FR-018 dostaje trzecią dosłowną kopię, wbrew uzasadnieniu `CompositionGate`

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 2 (trasa + kryterium 2.5); Faza 3 (`CompositionGate`)
- **Szczegóły**: faza 3 argumentuje, że bramka „nie może się rozdwoić", bo komunikat progu musi
  istnieć raz — ale tekst już dziś stoi w `EmbarkGate.tsx:57` **i** `api/teams/index.ts:62`.
  Faza 2 dokłada trzecią kopię („dosłownie ten sam tekst progu"), a kryterium 2.5 to sankcjonuje:
  sprawdza brak drugiej kopii **liczenia**, nie **tekstu**. Skutek uboczny: przycisk „Save changes"
  z podpisem „…before the team can **embark**".
- **Poprawka**: `BELOW_THRESHOLD_MESSAGE` i `INVALID_PAYLOAD_MESSAGE` eksportowane
  z `@/lib/team-submission`; bramka i obie trasy importują. Kryterium 2.5 rozszerzone o brak
  literału tekstu. Uzasadnienie fazy 3 przeniesione z tekstu na próg i `disabled`.
- **Decyzja**: NAPRAWIONE — nowy pkt 1 w fazie 2 (renumeracja pozostałych) + 5 miejsc.
  Efekt uboczny: domknięty też trzeci drobiazg z F7 (komunikat gałęzi `null` = `"Could not save the team"`).

### F6 — Kryterium 3.5 `! grep -rn "EmbarkGate" src/` jest niespełnialne listą plików planu

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 → kryteria sukcesu (3.5)
- **Szczegóły**: `EmbarkGate` występuje w `src/` **czterokrotnie**, nie trzykrotnie. Czwarte
  wystąpienie to docstring `COMPOSITION_FIELD` w `src/lib/team-submission.ts:19` — plik nieobecny
  na liście fazy 3. Kryterium wyszłoby czerwone i zmusiło implementatora do edycji spoza planu.
  Ta sama klasa: `src/pages/teams/[id].astro:10` („w trybie odczytu") — plan usuwał tylko blok 97-104.
- **Poprawka**: obie aktualizacje komentarzy dopisane do umów fazy 3 (pkt 1 i pkt 4).
- **Decyzja**: NAPRAWIONE.

### F7 — Drobiazgi w kryteriach

- **Waga**: 👁 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 kryteria ręczne; Faza 2 kryteria automatyczne
- **Szczegóły**: (1) „tabela `teams` ma **cztery** polityki: insert, select, update" — trzy;
  (2) kryterium 2.4 to jawna „kontrola wzrokowa diffu" pod nagłówkiem *Automatyczna weryfikacja*,
  bez polecenia do uruchomienia — `/10x-implement` traktuje tę sekcję jako komendy;
  (3) komunikat gałęzi `null` zapisany jako `?error=…` (naprawione przy F5).
- **Poprawka**: „cztery" → „trzy"; 2.4 rozbite na dwa uruchamialne grepy (brak JSON-a; liczba
  `return` == liczba `context.redirect`), z renumeracją Progress fazy 2 do 2.1–2.9.
- **Decyzja**: NAPRAWIONE.

## Twierdzenia planu potwierdzone jako poprawne

- `toTeamComposition` ma jednego importera; rozcięcie pomocników (`isRecord` → `isStringArray` →
  `toMemberSelection` → `toTeamComposition`) jest jednokierunkowe i bezcyklowe, żaden plik testowy
  nie zależy od tej funkcji.
- `grep -rn "<TeamComposer" src/pages/` zwraca dokładnie dwa wiersze; poza `src/pages/` brak
  innych renderów. `/teams/[id]/embark.astro` w ogóle nie renderuje wyspy.
- `! grep -rn "readOnly" src/` przejdzie — `readOnly` występuje wyłącznie w `TeamComposer.tsx`
  i `[id].astro`; `readOnly` bramkuje dokładnie trzy gałęzie, tak jak plan pisze.
- `ServerError` (`src/components/auth/ServerError.tsx`) jest bezstanowy, sam obsługuje `null`
  i renderuje się serwerowo — dyrektywa hydratacji niepotrzebna, dokładnie jak w `new.astro:47`.
- `resolveSavedTeam` faktycznie odcina skład niezłożalny z pulą przed wyspą (`team-view.test.ts`).
- `PROTECTED_ROUTES` chroni `/api/teams/<uuid>` przez `startsWith` bez zmiany w middleware.
- Sekcja `## Progress` była (i pozostaje) mechanicznie poprawna.

## Domknięcie

`plan-brief.md` dosunięty do planu 2026-09-06 (10 miejsc): tabela decyzji (stałe komunikatów,
`handlers` wymagany, F7 odroczony), zakres w obie strony, tabela faz, diagram, szacunek wysiłku
i ryzyko F8 przepisane na słownik publishable/secret.
