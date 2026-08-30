# Wykonywalna weryfikacja reguły siedmiu kompetencji — krótki plan

> Pełny plan: `context/changes/domain-rule-verification-harness/plan.md`
> Element mapy drogowej: `context/foundation/roadmap.md` → F-01 (kamień milowy M-1)

## Co i dlaczego

Reguła domenowa team-makera — siedem kompetencji, próg dwóch punktów, limity składu — nie istnieje
dziś nigdzie w kodzie, a projekt nie ma czym jej sprawdzić. Ten fundament wydziela ją do jednego
czystego modułu i wpina uruchamiacz testów, który weryfikuje ją jednym poleceniem, lokalnie i w CI.
PRD nazywa weryfikację testem warunkiem wiążącym, a mapa drogowa opiera na tym fundamencie dowody
trzech późniejszych pozycji (F-02, S-03, S-07).

## Punkt wyjścia

`src/lib/` zawiera wyłącznie klienta Supabase, `cn()` i status konfiguracji — zero typów drużyny,
postaci i kompetencji. `package.json` nie ma uruchamiacza testów, a `AGENTS.md` odnotowuje to jako
stan świadomy. CI robi dziś trzy rzeczy: `astro sync`, `lint`, `build`.

## Pożądany stan końcowy

Istnieje `src/lib/domain/` — moduł bez jakiejkolwiek zależności od Astro, Supabase i przeglądarki
— który dla dowolnego składu zwraca siedem sum punktowych, braki do progu, listę naruszonych
limitów i binarny werdykt. `npm test` uruchamia nazwany zestaw przypadków wiążących tę regułę,
a CI przechodzi przez ten sam krok między `lint` a `build`. Rozluźnienie progu lub limitu
w module czerwieni zestaw.

## Kluczowe podjęte decyzje

| Decyzja                           | Wybór                                                    | Dlaczego                                                                                             |
| --------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Zasięg weryfikacji (pytanie #2 mapy) | Tylko czysta reguła                                     | Zapis i izolacja kont wymagałyby tabeli, trasy API i dwóch kont — F-01 pochłonąłby S-03 i S-07.       |
| Uruchamiacz                       | Vitest 4 (`npm test` = `vitest run`)                      | Vite 7 jest już w drzewie zależności; alias `@/*` kosztuje jedną linijkę, bez dodatkowej paczki.      |
| Kontrakt reguły                   | Jedna funkcja `evaluateTeam`, jeden wynik                 | Wykres, licznik braków i bramka zapisu czytają jedno źródło, więc nie mogą się rozjechać.            |
| Limity składu                     | W wyniku, jako lista naruszeń                             | Skład nielegalny nigdy nie dostaje werdyktu pozytywnego — „limity nie do obejścia” z PRD.            |
| Dane wejściowe                    | Ręcznie dobrane fixture'y                                 | Docelowa pula 10–12 postaci i dowód jej rozwiązywalności to wynik F-02, nie tego fundamentu.          |
| Siedem kompetencji                | Typ związany, nazwy robocze                               | Kompilator pilnuje kompletności siedmiu osi; nazwy fabularne może zamienić F-02.                      |
| Miejsce w CI                      | Po `lint`, przed `build`                                  | Build jako jedyny krok wymaga sekretów Supabase — test przed nim daje sygnał także na PR z forka.     |
| Narzędzie CLI                     | Odrzucone                                                 | „Dowolny skład” realizujemy przez dopisanie przypadku; druga powierzchnia wejściowa bez pokrycia w FR. |

## Zakres

**W zakresie:** vitest + `vitest.config.ts` + skrypt `npm test`; krok testowy w `ci.yml`; korekta
twardej reguły w `AGENTS.md`; `src/lib/domain/` (siedem kompetencji, encje, stałe, `evaluateTeam`);
fixture'y i zestaw jedenastu przypadków; jeden test istniejącego `cn()` jako dowód działania
narzędzia.

**Poza zakresem:** baza danych, migracje i RLS; trasa API zapisu; weryfikacja izolacji dwóch kont;
docelowa pula postaci i dowód jej rozwiązywalności; jakikolwiek interfejs użytkownika i wykres;
`zod`; testy E2E, przeglądarkowe i komponentowe; coverage; CLI przyjmujący skład z terminala;
zmiany we wdrożeniu.

## Architektura / Podejście

Jeden czysty moduł `src/lib/domain/` (`types.ts` → `evaluate-team.ts` → `index.ts`) bez importów
z `astro:*` i Supabase — dzięki temu Vitest uruchamia go jako zwykły kod Node, bez bootstrapu
Astro. Wejściem jest zamknięta pula postaci plus skład wybrany przez gracza; wyjściem jeden obiekt
niosący sumy, braki, naruszenia i werdykt. Każdy późniejszy fragment (wykres z S-02, zapis z S-03,
edycja z S-05, licznik z S-08) woła tę samą funkcję.

## Fazy w skrócie

| Faza                             | Co dostarcza                                                     | Kluczowe ryzyko                                                                     |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Uruchamiacz i CI              | `npm test` działa lokalnie i w CI; `AGENTS.md` zgodny z rzeczywistością | Pierwsza nowa zależność — tarcie z typowanym ESLint-em, buildem Astro albo CI.  |
| 2. Kontrakt reguły               | `src/lib/domain/` z typami i `evaluateTeam`                        | Przypadkowy import `astro:*` zamienia czystą funkcję w kod wymagający runtime'u.      |
| 3. Zestaw weryfikacyjny          | Fixture'y i jedenaście nazwanych przypadków                        | Testy limitów przechodzące „przypadkiem”, bo sumy i tak nie domykają progu.            |

**Wymagania wstępne:** brak — F-01 nie ma poprzedników w mapie drogowej.
**Szacowany nakład pracy:** ~1–2 sesje w trzech fazach; największy pojedynczy koszt to Faza 3.

## Otwarte ryzyka i założenia

- Nazwy siedmiu kompetencji są robocze; jeśli F-02 nada im nazwy fabularne, zmiana dotknie
  `types.ts`, fixture'ów i asercji — kompilator wskaże każde miejsce.
- Fixture'y nie dowodzą niczego o docelowej puli postaci. Warunek wiążący z PRD („istnieje co
  najmniej jedno rozwiązanie domykające próg”) zostaje otwarty aż do F-02 — świadomie.
- Guardrail „reguła obowiązuje także poza interfejsem” pozostaje nieudowodniony do S-03, bo do
  tego czasu nie ma ścieżki zapisu, którą można by obejść.
- Vitest dokłada kilkadziesiąt paczek tranzytywnych. Przy głównym ryzyku `time` to jedyny koszt
  narzędziowy tego kamienia milowego i został przyjęty świadomie.

## Kryteria sukcesu (podsumowanie)

- Jedno polecenie (`npm test`) sprawdza regułę siedmiu kompetencji bez uruchamiania przeglądarki
  i bez połączenia z Supabase.
- Rozluźnienie progu lub limitu składu w module domenowym natychmiast czerwieni zestaw — reguła
  jest związana zachowaniem, nie deklaracją.
- Każdy PR przechodzi przez ten sam krok w CI, więc weryfikacja nie może zostać po cichu pominięta.
