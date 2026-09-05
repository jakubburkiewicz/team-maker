# Rozwiązywalna pula 10–12 postaci wraz z perkami — krótki plan

> Pełny plan: `context/changes/solvable-character-pool/plan.md`
> Element mapy drogowej: `context/foundation/roadmap.md` → F-02 (kamień milowy M-1)
> Wymaganie wstępne: `context/archive/2026-08-30-domain-rule-verification-harness/`

## Co i dlaczego

PRD nazywa dobór puli postaci **wiążącym warunkiem poprawności**, nie kwestią smaku: sześć postaci
wnosi najwyżej sześć specjalizacji przy siedmiu kompetencjach, więc pula dobrana na oko może
uczynić łamigłówkę nierozwiązywalną — a wtedy produkt nie ma czego demonstrować. Ta zmiana dostarcza
dwanaście postaci z treścią, dowodzi wyczerpującym przeszukaniem, że skład domykający próg istnieje,
i przenosi pulę do Supabase.

## Punkt wyjścia

F-01 zostawił gotowy kontrakt (`Character`, `Perk`, `CharacterPool`, `evaluateTeam`) i zestaw
testowy, ale jedyna istniejąca pula to ośmioosobowy fixture, który sam o sobie mówi, że nie jest
docelowy. `supabase/` nie ma katalogu `migrations/` — ta zmiana tworzy pierwszą migrację projektu.
Projekt hostowany nie jest zlinkowany.

## Pożądany stan końcowy

Dwanaście postaci z anglojęzyczną treścią istnieje dwiema drogami zgodnymi ze sobą z konstrukcji:
jako stała w module domenowym i jako wiersze w tabelach `characters` i `perks`, wstawione migracją
wygenerowaną z tej samej stałej. `npm test` orzeka wyczerpująco, że pula jest rozwiązywalna, bez
uruchamiania bazy i bez sieci. Jedna funkcja odczytu zwraca `CharacterPool` gotowe do podania do
`evaluateTeam` — S-01 zastaje dane, nie surową tabelę.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Umiejscowienie puli | Tabela w Supabase | Decyzja użytkownika wbrew rekomendacji planu (stała w kodzie); pierwsza migracja projektu powstaje wcześniej, więc S-03 zastaje gotowy warsztat | Plan (użytkownik) |
| Źródło prawdy dla treści | Plik danych w repo → migracja zasiewowa | Dowód rozwiązywalności zostaje czysty (zero importów Supabase, twarda reguła `AGENTS.md`) i dowodzi danych, które realnie trafiają do bazy | Plan |
| Zgodność pliku z migracją | Renderer + dosłowne zawieranie w teście | Parser SQL byłby drugim kawałkiem logiki wymagającym zaufania dokładnie tam, gdzie dowodzimy wiążącego warunku PRD | Plan |
| Pola treściowe | Nazwa + jednozdaniowy opis + nazwy perków | Tyle, ile potrzebuje prawa kolumna okna wyboru (FR-013) i etykiety perków (FR-014) — S-01 nie musi wymyślać treści | Plan |
| Rozszerzenie typów | `PoolCharacter extends Character` | `perks` jest `readonly`, więc zawężenie jest przypisywalne do `CharacterPool` — zero zmian w regule i w fixture'ach F-01 | Plan |
| Nazwy siedmiu kompetencji | Zostają robocze | Czytelne dla obcego bez tutoriala, czyli pod personę główną; spójne z anglojęzycznym interfejsem | Plan |
| Siła dowodu | Wyczerpujące przeszukanie całej puli | To dosłownie wiążący warunek PRD sprawdzony, a nie założony; przycięcie braków do progu daje dokładność w milisekundach | Plan |
| Kalibracja trudności | Komfortowo rozwiązywalna | Kryterium sukcesu wymaga przejścia recenzenta „bez tutoriala i bez pomocy z zewnątrz"; PRD odrzuciło solver podpowiadający (FR-020) | Plan |
| Treść postaci | Agent generuje, po angielsku, użytkownik recenzuje | Spójne z istniejącą kopią interfejsu (`lang="en"`); dobór perków i fabuła projektowane razem | Plan |
| RLS | Tylko `SELECT` dla `authenticated` | Non-Goal „tworzenie własnych postaci" egzekwowany przez bazę; cała aplikacja stoi za logowaniem (FR-004) | Plan |
| Typy bazy | Bez `supabase gen types` | Wymaga zlinkowanego projektu albo Dockera; brak drugiego konsumenta | Plan |
| Zasiew | Migracja, nie `seed.sql` | `[db.seed]` działa wyłącznie przy lokalnym `db reset` i nigdy nie dociera na produkcję | Plan |

## Zakres

**W zakresie:** `PoolCharacter`/`PoolPerk` w `types.ts`; `CHARACTER_POOL` (12 postaci, treść
angielska); wyczerpujący solver (`findThresholdSolution`, `countThresholdSolutions`); zestaw
weryfikacyjny puli; migracja schematu (enum `competency`, `characters`, `perks`, RLS); renderer
SQL i migracja zasiewowa; test zgodności; `getCharacterPool` z czystym `mapPoolRows` i jego test;
zastosowanie migracji na projekcie hostowanym.

**Poza zakresem:** jakikolwiek interfejs (okno wyboru, wykres — S-01/S-02); tabela `teams`
i zapis drużyny (S-03); zmiana nazw kompetencji; zmiany w `evaluateTeam` i `test-fixtures.ts`;
`supabase gen types`; `zod`; trasa diagnostyczna; portrety, frakcje i opisy perków;
`supabase config push`.

## Architektura / Podejście

```
CHARACTER_POOL (src/lib/domain/character-pool.ts)   ← autorskie źródło prawdy
   ├─→ solvability.ts ──→ character-pool.test.ts    ← wiążący dowód, czysty, bez bazy
   ├─→ character-pool-sql.ts ──┬─→ migracja zasiewowa (dosłownie)
   │                           └─→ test zgodności (node:fs, bez Supabase)
   └─→ (kształt) ──────────────→ characters + perks w Supabase
                                       ↓
                            getCharacterPool(supabase)  →  CharacterPool  →  evaluateTeam
```

Solver unika 108 mln kombinacji jedną obserwacją: **próg jest sufitem**. Punkty ponad dwa nie
zmieniają werdyktu, więc stanem przeszukiwania jest wektor braków przycięty do 0–2 — 3⁷ = 2187
stanów zamiast nieograniczonej przestrzeni sum. Z memoizacją przeszukanie jest dokładne i zamyka
się w milisekundach.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Pula i jej dowód | 12 postaci z treścią, solver, zestaw weryfikacyjny | Solver jako jedyny świadek własnej poprawności — powtórka ustalenia F2 z przeglądu F-01 |
| 2. Schemat, RLS i zasiew | Pierwsze migracje projektu, polityki tylko do odczytu, test zgodności | Cichy rozjazd stałej z migracją; migracja wygenerowana z puli bez dowodu utrwala błąd |
| 3. Odczyt puli z bazy | `getCharacterPool` + czyste `mapPoolRows` | Import `@/lib/supabase` w module pod testem łamie twardą regułę `AGENTS.md` |
| 4. Zastosowanie na produkcji | Migracje na projekcie hostowanym | `supabase config push` uruchomione przy okazji linkowania — skierowałoby produkcyjne linki mailowe na localhost |

**Wymagania wstępne:** F-01 (zarchiwizowane 2026-08-30). Do Faz 2–4: Docker dla `supabase start`
oraz `project-ref` hostowanego projektu.
**Szacowany nakład pracy:** ~2 sesje w czterech fazach; największy pojedynczy koszt to redakcja
treści dwunastu postaci w Fazie 1.

## Otwarte ryzyka i założenia

- Wybór bazy zamiast stałej w kodzie oznacza, że pula ma dwie reprezentacje. Trzyma je razem
  wyłącznie test zgodności — ręczna edycja wierszy w bazie z pominięciem migracji rozjedzie je
  po cichu, a test tego nie zobaczy.
- Dolny próg liczby rozwiązań („komfortowo rozwiązywalna") jest wyborem projektowym, nie zapisem
  PRD. PRD wymaga wyłącznie istnienia rozwiązania.
- Fazy 2 i 3 nie mają automatycznej weryfikacji przy działającej bazie — CI nie ma Dockera,
  a twarda reguła zakazuje testom sięgania po Supabase. Poprawność RLS opiera się na weryfikacji
  ręcznej.
- Faza 4 linkuje projekt hostowany, przez co `supabase config push` staje się o jedno polecenie
  bliżej. Zakaz z `AGENTS.md` obowiązuje nadal i zyskuje na wadze.
- Treść dwunastu postaci powstaje po angielsku obok polskiego PRD i polskich komentarzy w kodzie.
  Rozjazd jest świadomy — interfejs jest anglojęzyczny, a PRD wyklucza warstwę tłumaczeń.

## Kryteria sukcesu (podsumowanie)

- Wiążący warunek PRD („istnieje co najmniej jedno rozwiązanie domykające próg") jest sprawdzany
  jednym poleceniem, wyczerpująco, bez bazy i bez sieci.
- Edycja treści puli, która zabije rozwiązywalność albo rozjedzie plik z migracją, czerwieni zestaw.
- S-01 może pobrać pulę jednym wywołaniem i podać ją wprost do `evaluateTeam`, bez mapowania
  po swojej stronie.
