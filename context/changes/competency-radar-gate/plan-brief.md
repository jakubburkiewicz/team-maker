# Wybór perków, wykres pajęczynowy i blokada progu (S-02) — Krótki plan

> Pełny plan: `context/changes/competency-radar-gate/plan.md`

## Co i dlaczego

Fragment S-02 czyni regułę domenową widoczną: na `/teams/new` gracz wybiera do dwóch z trzech
perków każdego członka, widzi wykres pajęczynowy siedmiu kompetencji przeliczany po każdej zmianie
i przycisk „Embark on the job" („Wyrusz na zlecenie" z PRD), zablokowany z komunikatem ogólnym,
dopóki którakolwiek kompetencja ma mniej niż 2 punkty. PRD nazywa wykres najdroższym elementem
interfejsu w MVP, a blokada z FR-018 jest warunkiem wstępnym zapisu (S-03), nie ozdobą.

## Punkt wyjścia

S-01 dostarczył wyspę `TeamComposer` ze składem w pamięci, oknem wyboru członka i slotami; skład
rośnie i maleje wyłącznie przez `addMember` / `removeMember`. Domena z F-01 (`evaluateTeam`:
`scores`, `missing`, `violations`, `isValid`) istnieje, ale nikt z interfejsu jej nie woła;
`perkIds` w stanie jest zawsze `[]`, bo nie ma pisarza perków. Zero bibliotek wykresów i zero SVG
w repo.

## Pożądany stan końcowy

Dwie kolumny: sloty z przełącznikami perków po lewej, wykres z pierścieniem progu i przycisk po
prawej. Każde kliknięcie zmienia wielokąt od razu; przy 2/2 trzeci perk jest wyłączony; gdy
siedem osi sięga pierścienia, przycisk się odblokowuje — i blokuje z powrotem po zdjęciu perka
lub członka. Odblokowany przycisk jeszcze nic nie robi (zapis to S-03).

## Kluczowe podjęte decyzje

| Decyzja                     | Wybór                                                        | Dlaczego (1 zdanie)                                                                                         |
| --------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Miejsce wyboru perków       | Karta zajętego slotu; okno wyboru zostaje do odczytu         | Przełącznik i skutek na wykresie w jednym polu widzenia; S-05 reużywa te same karty bez okna.               |
| Zachowanie przy 2/2         | Trzeci perk wyłączony (`disabled`)                           | Limit nazwany i widoczny (FR-014), ta sama zasada co „brak Recruit przy 6/6"; domena i tak odrzuca.         |
| Wykres                      | Ręczny inline SVG + czysty helper geometrii w `src/lib/`     | Zero zależności (precedens F-01), pełna kontrola motywu cosmic, geometria testowalna bez jsdom.              |
| Skala wykresu               | `max(2 × próg, najwyższa suma)`, nigdy nie obcina            | Obcięcie łamałoby Guardrail „wykres zawsze zgodny ze składem"; próg w połowie promienia jest czytelny.       |
| Układ                       | Dwie kolumny: skład \| wykres + przycisk, strona `max-w-6xl` | FR-016 wymaga natychmiastowego skutku w zasięgu wzroku; S-08 ma gdzie dodać licznik „obok wykresu".         |
| Etykieta przycisku          | Angielska „Embark on the job"                                | Cały interfejs i treść puli są po angielsku; jedyny polski napis wyglądałby na błąd.                         |
| Odblokowany przycisk w S-02 | Bez handlera — sama bramka                                   | Zero kodu do wyrzucenia; „Work in Progress" bez zapisu to kontrargument, który PRD odrzucił (FR-019).        |
| Komunikat ogólny            | Statyczny tekst pod przyciskiem, `aria-describedby`          | `Button` ma `disabled:pointer-events-none` — tooltip na zablokowanym przycisku nie zadziała.                 |
| Testy                       | Domena (`togglePerk`) + geometria wykresu; bez jsdom         | Guardrail dostaje dowód bez nowych zależności; strategia testów komponentów to Moduł 3.                      |
| Dług F6 z przeglądu S-01    | Wariant `cosmic` w `buttonVariants`, migracja dwóch kopii    | Przegląd wprost odłożył to do S-02; czwarta kopia ciągu klas nie powstaje.                                   |

## Zakres

**W zakresie:**
- `togglePerk` w `src/lib/domain/roster.ts` z testami zgodności z `evaluateTeam` i dowodem, że
  próg jest osiągalny wyłącznie przez pisarzy składu
- `src/lib/radar-geometry.ts` + testy; `CompetencyRadar`, `EmbarkGate`, wariant `cosmic`
- `RosterSlot` z przełącznikami perków; podpisy „+2 points" / „+1" i wskazówka w oknie wyboru
- Układ dwukolumnowy wyspy i strony; domknięcie niewiadomej S-02 w roadmapie

**Poza zakresem:**
- Zapis, tabela `teams`, trasa API, nazwa-hash, „Work in Progress" (S-03)
- Lista brakujących punktów (S-08) — `missing` liczone, nierenderowane
- Wybór perków w oknie, automatyczna zamiana perka, biblioteka wykresów, animacje, tooltipy
- Testy komponentów React, trwałość składu, mobile, przebudowa motywu

## Architektura / Podejście

Wyspa `TeamComposer` (jedyny właściciel `composition`) woła przy renderze
`evaluateTeam(composition, pool)`. `scores` → `radarLayout` → `CompetencyRadar` (SVG);
`isValid` → `EmbarkGate`. Skład zmieniają wyłącznie `addMember` / `removeMember` / `togglePerk`,
więc `violations` jest puste z konstrukcji — warunek z umowy F-01 („czytaj `scores` tylko przy
pustym `violations`") spełniony i udowodniony testem, z jednolinijkową gałęzią obronną w wyspie.
Bez memoizacji: react-compiler, koszt pomijalny wobec 200 ms.

## Fazy w skrócie

| Faza                             | Co dostarcza                                                                     | Kluczowe ryzyko                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Pisarz perków w domenie       | `togglePerk` z limitem 2/3, eksport, testy zgodności + próg osiągalny przez pisarzy | Kolejność sprawdzeń (odznaczanie przed limitem) — inaczej członek z 2/2 nie zdejmie perka |
| 2. Wykres i bramka               | Geometria + testy, `CompetencyRadar`, `EmbarkGate`, wariant `cosmic`, dwie kolumny | Skala obcinająca wielokąt złamałaby Guardrail; etykiety osi SVG do ręcznego pozycjonowania |
| 3. Perki na karcie slotu         | Przełączniki spięte z `togglePerk`, podpisy w oknie, wpis w roadmapie            | Karta slotu rośnie — siatka 2 kolumn musi pomieścić 3 perki bez przewijania            |

**Wymagania wstępne:** S-01 zarchiwizowane (jest); `npm run dev` z `.env` i zalogowanym kontem
do weryfikacji ręcznej; Node 22.14.0 (`nvm use`).
**Szacowany wysiłek:** ~2–3 sesje w 3 fazach; Faza 2 największa (SVG).

## Otwarte ryzyka i założenia

- Założenie: `findThresholdSolution(CHARACTER_POOL)` zwraca skład, którego perki mieszczą się
  w limicie 2/członka (solver respektuje `MAX_PERKS_PER_MEMBER` — potwierdzone
  w `character-pool.test.ts`); test „próg osiągalny przez pisarzy" na tym polega.
- Ryzyko: ręczne etykiety SVG mogą nachodzić na wielokąt przy długich nazwach
  (`negotiation`, `engineering`) — `labelOffset` i `text-anchor` zależny od strony osi to
  lokalna korekta, nie zmiana planu.
- Ryzyko: zmiana propsów `RosterSlot` (Faza 3) jest łamiąca; jedyny konsument to `TeamComposer`.
- Założenie: S-03 dołoży handler/formularz do `EmbarkGate` bez zmiany jego kontraktu wizualnego.

## Kryteria sukcesu (podsumowanie)

- Gracz bez znajomości mechaniki domyka próg przepisem z sześciu postaci i dwóch perków, widzi
  odblokowany przycisk, a po zdjęciu perka — zablokowany z powrotem (FR-014, FR-015, FR-018).
- Wykres reaguje na każdą zmianę natychmiast i nigdy nie pokazuje punktów, których reguła nie
  przyznaje (FR-016, Guardrail).
- `npm test` dowodzi limitu perków, zgodności z `evaluateTeam` i wierności geometrii;
  `package.json` bez nowych zależności.
