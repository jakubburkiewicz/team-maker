# Refresh test-plan.md — krótki plan

> Pełny plan: `context/changes/2026-09-07-test-plan-refresh/plan.md`
> Badania (źródło wszystkich korekt): `context/changes/2026-09-07-testing-save-barrier/research.md`

## Co i dlaczego

`context/foundation/test-plan.md` cytuje twardą regułę, która została przepisana. Commitem
`62a6f68` reguła czystości testów w `AGENTS.md` przeszła z kryterium tekstowego („nic pod testem
nie może importować `astro:*` ani `@/lib/supabase`") na kryterium runtime („liczy się, co się
ewaluuje w czasie testu"). Przewodnik niesie starą literę i w kilku miejscach nazywa wynikające
z niej pytanie otwartym, choć zostało rozstrzygnięte. Drugi wątek: przewodnik opiera odpowiedź
na ryzyko izolacji o prawdziwego Postgresa, którego CI nie ma i mieć nie będzie.

## Punkt wyjścia

Przewodnik powstał 2026-09-07 i jest świeży we wszystkim poza tymi dwiema rzeczami. Obalone
twierdzenia żyją w **dziewięciu** miejscach w sześciu sekcjach — §2 (ryzyko #1 i dwa wiersze
*Response*), §3 (wiersz Fazy 2 i akapit uzasadnienia kolejności), §4 (ograniczenia twarde
i wiersz integration), §5 (bramka izolacji), §6.1 i §6.3. Rollout Faza 1
(`2026-09-07-testing-save-barrier`, status `researched`) czeka na ten refresh, bo jej `/10x-plan`
ma czytać poprawione §2 i §4.

## Pożądany stan końcowy

Przewodnik czytany wyrywkowo — jeden wiersz tabeli, jedna podsekcja — nie prowadzi do obalonego
wniosku. Każdy cytat reguły zgadza się z `AGENTS.md:11`; żadne miejsce nie nazywa pytania
o wykonanie testu otwartym; odpowiedź na ryzyko #2 jawnie rozdziela to, co udowodni bramka CI,
od tego, co zostaje dymem ręcznym. Strategia (§1), sześć ryzyk, kolejność faz i §7 przestrzeń
negatywna są bit-w-bit nietknięte.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Zakres pięciu korekt | Zachowany bez zmian | Użytkownik przesądził: te same ryzyka, tylko odpowiedź stała się tańsza | change.md |
| Ryzyko #2 — granica dowodu | Tor żądania w CI (atrapa klienta, dwie tożsamości); RLS jako dym lokalny/ręczny | `ci.yml:21` woła gołe `npm test` bez `services:`, `env:` i Dockera; bariera, o którą chodzi, stoi przed bazą | Plan |
| Bramka §5 „integration na izolacji" | Zostaje `required after §3 Phase 2` | Warstwa toru żądania jest w CI wykonalna; zejście do `recommended` zostawiłoby bez automatu klasę strażników, która już raz zawiodła | Plan |
| Zasięg poza literę change.md | Wszędzie, gdzie żyje obalone zdanie | Przewodnik czyta się wyrywkowo — jedna nieaktualna linijka w §6.1 myli tak samo jak w §4 | Plan |
| Anty-wzorzec fake-drift | Kolumna anty-wzorców §2, wiersze #1, #2, #6 | Tam czytają go `/10x-research` i `/10x-plan` każdej z tych faz; §1 zostaje zamrożona | change.md + Plan |
| §8 stempel | Daty + jedna linia „ostatni refresh" (nadpisywana, nie changelog) | Daty już brzmią 2026-09-07, więc bez adnotacji refresh jest niewidoczny; git trzyma historię | Plan |
| Fałszywa teza w archiwum | Nietknięta | `AGENTS.md`: archiwum niezmienne. Unieważniamy ją tylko w przewodniku | Badania |

## Zakres

**W zakresie:** §2 brzmienie ryzyka #1, kolumny kontekstu wierszy #1 i #2, najtańsza warstwa
wiersza #2, anty-wzorce w #1/#2/#6 · §3 wiersz Fazy 2 i akapit uzasadnienia kolejności ·
§4 ograniczenia twarde i wiersz integration · §5 bramka izolacji · §6.1 punkt „Czystość" ·
§6.3 opis placeholdera · §8 ledger i nagłówek.

**Poza zakresem:** lista i oceny sześciu ryzyk · §1 Strategy · §7 przestrzeń negatywna ·
kolejność i statusy faz §3 · cytaty hot-spotów · placeholdery §6.2 i §6.4–§6.6 · kod testowy ·
`vitest.config.ts` · `ci.yml` · `context/archive/`.

## Architektura / Podejście

Jeden plik, wyłącznie zamiany istniejącego tekstu, zero zmian struktury nagłówków. Kolejność faz
idzie od źródła korekty do jej konsekwencji: §4 (gdzie mieszka cytat z `AGENTS.md`) → §2 (gdzie
mieszka odpowiedź na ryzyka) → propagacja do §3/§5/§6 → stempel i kontrola. Nie jest dowolna:
wiersz #2 przeformułowuje się wobec granicy CI/ręczne, a ta bierze się z kryterium runtime
zapisanego w §4.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. §4 Stack | Cytat reguły zgodny z `AGENTS.md:11`; wiersz integration z pytania otwartego na rozstrzygnięcie | Zwinięcie czterech elementów reguły do „reguła się zmieniła" — punkt o `vi.mock` jest tym, który odblokowuje warstwę |
| 2. §2 Risk Map | Zawężone ryzyko #1, granica CI/ręczne dla #2, anty-wzorzec fake-drift w trzech wierszach | Przepisanie dosłownego cytatu PRD w kolumnie *Source*, albo wprowadzenie kotwic plik:linia wbrew §1 zasadzie #3 |
| 3. Propagacja §3/§5/§6.1/§6.3 | Usunięcie obalonych twierdzeń z pięciu miejsc, w tym §6.1 | §6.1 to wypełniona instrukcja, nie placeholder — łatwo ją przeoczyć i zostawić zalecenie „wydziel czysty rdzeń" |
| 4. Stempel i kontrola | §8, `change.md` → `planned`, dwukierunkowa kontrola dyffu | Regresja zakresu: dotknięcie §1, §7 albo listy ryzyk |

**Wymagania wstępne:** żadne — `research.md` Fazy 1 jest kompletny i gruntuje wszystkie korekty.
**Szacowany wysiłek:** ~1 sesja, cztery fazy edycji jednego pliku dokumentacji.

## Otwarte ryzyka i założenia

- Fazy 1–3 nie mają prawdziwej weryfikacji automatycznej — grep dowodzi, że stara fraza zniknęła,
  ale nie że nowa jest poprawna. Ciężar spoczywa na weryfikacji ręcznej każdej fazy.
- Granica CI/ręczne dla ryzyka #2 opiera się na założeniu, że `ci.yml` nie dostanie `services:`
  w przewidywalnym horyzoncie. Gdyby dostał, §2 wiersz #2 i §5 wracają na stół.
- Anty-wzorzec fake-drift ląduje w trzech kopiach; przy późniejszej edycji któraś może się
  rozjechać. Świadomie przyjęte — §1 zostaje zamrożona.
- Faza 4 potwierdza tylko, że Faza 1 rolloutu *może* ruszyć. Sam `/10x-plan` Fazy 1 jest osobnym
  przekazaniem i nie wchodzi w ten plan.

## Kryteria sukcesu (podsumowanie)

- Grep nad przewodnikiem nie znajduje ani starej litery reguły czystości, ani frazy o prawdziwym
  Postgresie jako warstwie testowej.
- `git diff` nie pokazuje ani jednej linii między `## 1.` a `## 2.` oraz między `## 7.` a `## 8.`
- `/10x-plan` Fazy 1 może ruszyć przeciwko §2 i §4, nie natrafiając na obalone twierdzenie.
