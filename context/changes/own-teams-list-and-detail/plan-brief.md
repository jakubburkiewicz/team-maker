# Lista własnych drużyn i widok zapisanej drużyny (S-04) — Krótki plan

> Pełny plan: `context/changes/own-teams-list-and-detail/plan.md`

## Co i dlaczego

Domykamy **odczyt** w pętli CRUD nad drużyną: gracz dostaje listę wyłącznie własnych zapisanych
drużyn i może otworzyć każdą z nich, żeby zobaczyć skład, perki i wykres kompetencji (FR-005,
FR-008). Bez tego fragmentu drużyna zapisana w S-03 jest osiągalna wyłącznie przez adres, który
gracz musiałby zapamiętać — a recenzent, dla którego optymalizujemy, nie ma jak zobaczyć „R"
z CRUD.

## Punkt wyjścia

Tabela `public.teams` istnieje od S-03 z RLS odcinającą cudze wiersze, jedynym pisarzem
`POST /api/teams` i stroną potwierdzenia `/teams/[id]/embark`. Repo czyta z niej tylko `id, name`
jednego wiersza, wyspa `TeamComposer` startuje zawsze z pustym składem, a `/teams` jako trasa
nie istnieje.

## Pożądany stan końcowy

Zalogowany gracz wchodzi na `/teams` i widzi swoje drużyny jako nazwy-hashe z datą zapisu — a nowe
konto widzi wyjaśnienie i wezwanie do skompletowania pierwszej, nie pustą tabelę. Kliknięcie
drużyny otwiera `/teams/[id]` z jej składem, perkami i wykresem w trybie tylko do odczytu. Cudze
lub nieistniejące `id` daje 404, nierozróżnialnie.

## Kluczowe podjęte decyzje

| Decyzja                                   | Wybór                                                          | Dlaczego                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Umiejscowienie listy                      | Nowa trasa `/teams`, dashboard linkuje                          | Mieści się w istniejącym prefiksie `PROTECTED_ROUTES`, więc FR-004 jest spełniony bez zmian w middleware.          |
| Tryb widoku szczegółów                    | `TeamComposer` w trybie `readOnly`                              | FR-008 rozstrzygnięty jako „jeden widok obsługuje oba przypadki"; S-05 zdejmie flagę zamiast budować trzeci ekran. |
| `characterId` spoza puli                  | Odmowa całej drużyny (stan awarii)                              | Częściowy render pokazałby skład inny niż zapisany, a S-05 zapisałby tę okrojoną wersję, kasując członka.          |
| Wiersz listy                              | Nazwa-hash + data zapisu                                        | Odpowiedź na kontrargument z FR-011 („hashe są nieodróżnialne") kosztem jednej kolumny, która już jest w schemacie. |
| Logika łączenia składu z pulą             | Nowy czysty moduł `src/lib/team-view.ts` + test Vitest          | Decyzja o czytelności drużyny dostaje dowód w CI; wzorzec `team-submission.ts`, strona `.astro` zostaje cienka.    |
| Zaczepy pod S-05 / S-06                   | Żadnych                                                         | Dyscyplina zakresu — wyłączone atrapy przycisków kłamałyby o dostępnych operacjach.                                |
| `/teams/[id]/embark`                      | Zostaje, dostaje tylko linki                                    | FR-019 nietknięty; ścieżka domyka się w pętlę zapis → lista → szczegóły.                                           |

## Zakres

**W zakresie:** trasa `/teams` z listą, stanem pustym i stanem awarii · trasa `/teams/[id]`
z widokiem tylko do odczytu i 404 · `listTeams` i `getTeamDetail` w repo · wydzielenie wspólnej
umowy kształtu składu · moduł `team-view.ts` odrzucający skład rozjechany z pulą, z testem ·
tryb `readOnly` w `TeamComposer` i `RosterSlot` · linki nawigacyjne z dashboardu i z potwierdzenia.

**Poza zakresem:** migracja bazy (polityki `update`/`delete` → S-05, S-06) · edycja składu (S-05) ·
usuwanie drużyny (S-06) · audyt izolacji wszystkimi ścieżkami (S-07) · licznik brakujących punktów
(FR-017 → S-08) · paginacja, sortowanie i wyszukiwanie listy · responsywność mobilna (Non-Goal PRD).

## Architektura / Podejście

`/teams` → `listTeams` → lista SSR bez hydratacji. `/teams/[id]` → `getTeamDetail` + `getCharacterPool`
→ `resolveSavedTeam` (werdykt z `evaluateTeam.violations`) → albo stan awarii, albo wyspa
`TeamComposer` w trybie `readOnly` ze składem jako wartością początkową `useState`. Reguła domenowa
nie jest nigdzie duplikowana: nowy moduł tylko czyta werdykt, który `evaluateTeam` i tak wydaje.
Izolacja kont pozostaje tam, gdzie była — w RLS.

## Fazy w skrócie

| Faza                                     | Co dostarcza                                                              | Kluczowe ryzyko                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Warstwa odczytu i weryfikacja składu  | `listTeams`, `getTeamDetail`, `team-view.ts` + test; zero zmian w UI       | Wydzielenie `toTeamComposition` może po cichu zmienić zachowanie zapisu — pilnują tego testy S-03. |
| 2. Lista pod `/teams`                    | Strona listy ze stanem pustym i awarii, wejście z dashboardu               | Stan pusty zrobiony jako „0 results" łamie kryterium akceptacji US-01.                          |
| 3. Widok `/teams/[id]`                   | Tryb `readOnly` w wyspie, strona szczegółów z 404, linki z potwierdzenia   | Rozjechanie się dwóch trybów tej samej wyspy — regresja w kompletowaniu na `/teams/new`.        |

**Wymagania wstępne:** S-03 zamknięte i zarchiwizowane (tabela `teams` z RLS, zapis działa) —
spełnione. Do ręcznej weryfikacji potrzebne dwa konta w Supabase.
**Szacowany wysiłek:** ~2–3 sesje w trzech fazach; bez migracji, bez `supabase db push`.

## Otwarte ryzyka i założenia

- Tryb `readOnly` przechodzi przez tę samą wyspę co kompletowanie, więc każda regresja w niej
  uderza w gwiazdę przewodnią (S-03). Krok 3.7 weryfikacji ręcznej istnieje wyłącznie po to.
- Odmowa pokazania drużyny rozjechanej z pulą nie ma ścieżki naprawczej dla gracza — przyjęte
  świadomie, bo pula jest zamknięta i zasiewana migracją, więc stan jest praktycznie nieosiągalny.
- Fragment nie dokłada żadnej bariery izolacji ponad RLS. To założenie jest wprost przedmiotem
  audytu w S-07; jeśli tam wyjdzie luka, dotknie także tych dwóch tras.

## Kryteria sukcesu (podsumowanie)

- Nowe konto na `/teams` dostaje wyjaśnienie i wezwanie do skompletowania pierwszej drużyny, a po
  zapisie widzi ją na liście i może ją otworzyć.
- Otwarta drużyna pokazuje dokładnie ten skład i te perki, które zapisano, z wykresem zgodnym ze
  składem — albo nie pokazuje nic.
- Drugie konto nie widzi cudzej drużyny ani na liście, ani po wklejeniu jej `id` w adres.
