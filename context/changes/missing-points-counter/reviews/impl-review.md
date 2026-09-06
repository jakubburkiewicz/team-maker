<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Licznik brakujących punktów (S-08)

- **Plan**: `context/changes/missing-points-counter/plan.md`
- **Zakres**: Pełny plan — Faza 1 i Faza 2 z 2 (26/26 pozycji Progress `[x]`)
- **Data**: 2026-09-06
- **Werdykt**: ZAAKCEPTOWANO
- **Triaż**: zakończony 2026-09-06 — F1 naprawione, F2 pominięte świadomie
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Weryfikacja kryteriów sukcesu

Wszystkie kryteria automatyczne obu faz uruchomiono **dosłownie**, na Node 22.14.0.

| Kryterium | Wynik |
| --- | --- |
| 1.1 `npx astro sync` + `npm run lint` | PASS (lint bez zgłoszeń; tylko ostrzeżenia parsera `astro-eslint-parser`) |
| 1.2 / 2.1 `npm test` | PASS — 13 plików, 148 testów |
| 1.3 `npx vitest run src/lib/missing-competencies.test.ts` | PASS — 8 przypadków (wymóg: ≥ 8) |
| 1.4 Kontrola mutacyjna A (odwrócona kolejność) | PASS — czerwieni przypadki 2 i 4 (a także 3); mutacja cofnięta, `npm test` zielony |
| 1.5 Kontrola mutacyjna B (warunek nieujemny) | PASS — czerwieni dokładnie przypadki 1, 3 i 5; mutacja cofnięta |
| 1.6 Kontrola mutacyjna C (brak liczby pojedynczej) | PASS — czerwieni dokładnie przypadek 7; mutacja cofnięta |
| 1.7 Helper bez `astro:*` / `@/lib/supabase` | PASS |
| 1.8 / 2.4 `git diff --quiet f11ba86 -- src/lib/domain/ …` | PASS |
| 1.9 / 2.6 `git diff --quiet f11ba86 -- package.json package-lock.json` | PASS |
| 2.1 `astro sync && lint && test && build` | PASS — build zakończony |
| 2.2 `grep -cE '^\s*\{evaluation\.violations\.length === 0 \?'` | PASS — wypisuje `1` |
| 2.3 `git diff --quiet f11ba86 -- CompositionGate.tsx` | PASS |
| 2.5 Strony nietknięte (pathspec `:(literal)`) | PASS |
| 2.7 `grep -n '~~\*\*Czy S-08' roadmap.md` | PASS — linia 359 |
| 2.8 `! grep -F 'so the chart cannot be shown'` | PASS |

Pozycje ręczne 1.10–1.11 i 2.9–2.15: potwierdzone przez człowieka na bramkach fazowych.
Dla większości istnieje dodatkowo pokrycie kodowe (2.9 i 2.11 wiąże `npm test`, 2.12 wynika
z `return null` w `MissingPointsList.tsx:27-29`, 2.13 z zielonego `git diff --quiet` na
`CompositionGate.tsx`). Bez pokrycia w diffie pozostaje wyłącznie 2.15 (układ przy siedmiu
wierszach) — kryterium z natury wzrokowe, brak dowodu jest tu oczekiwany, nie podejrzany.

## Ustalenia

### F1 — Test kolejności jest ślepy na sortowanie rosnące po wielkości luki

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `src/lib/missing-competencies.test.ts:73-95`
- **Szczegóły**: Plan (Faza 1, pkt 2, przypadek 4) wymagał rekordu, w którym „braki rosną
  **odwrotnie** do kolejności osi". Implementacja daje luki rosnące **zgodnie** z osiami
  (`combat: 1` … `navigation: 7`), czyli wariant lustrzany. Nie jest to kosmetyka: przy tym
  rekordzie kolejność osi i kolejność rosnąca po wielkości luki są **tą samą sekwencją**, więc
  asercja ich nie odróżnia. Sonda na żywym repozytorium (dopisany
  `.sort((a, b) => a.missing - b.missing)` w `missing-competencies.ts:30`, mutacja cofnięta)
  przechodzi **8/8 na zielono** — a jest to dokładnie ta klasa błędu, którą plan świadomie
  odrzucił („Odrzucono sortowanie po wielkości luki: wiersze przeskakiwałyby przy każdym
  kliknięciu perka"). Kontrola mutacyjna A sondowała tylko kierunek odwrócony i dlatego luki nie
  pokazała. **Plan miał tu ten sam błąd, tylko w drugą stronę**: jego wariant złapałby sortowanie
  rosnące, a przepuścił malejące. Monotoniczny rekord nie zwiąże obu kierunków w żadnym wariancie.
  To ta sama klasa co `lessons.md` §„Strażnik grepowy nad SQL-em ma pokrywać legalne warianty
  zapisu, nie jeden zapis" — strażnik pilnował **jednego wariantu operacji**, nie operacji.
- **Poprawka**: W przypadku kolejności zastąpić rekord monotoniczny **niemonotonicznym** względem
  osi, np. `combat: 3, hacking: 1, stealth: 2, engineering: 5, medicine: 4, negotiation: 7,
  navigation: 6` — wtedy ani sortowanie rosnące, ani malejące nie odtwarza kolejności osi, więc
  jedna asercja wiąże oba kierunki. Przesondować oba warianty `sort` przed odhaczeniem.
- **Decyzja**: NAPRAWIONE — rekord zmieniony na niemonotoniczny (`missing-competencies.test.ts:73-98`),
  z komentarzem nazywającym powód. Przesondowane trzy mutacje helpera, każda cofnięta:
  `sort` rosnący czerwieni 1 przypadek (przed poprawką przechodził 8/8), `sort` malejący 2,
  odwrócenie osi 3. Po sondach `git diff --quiet` na helperze czyste, `npm run lint` bez zgłoszeń,
  `npm test` 148/148.

### F2 — Blok JSDoc modułu zwisa między `interface` a pierwszą funkcją

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/lib/missing-competencies.ts:9-22`
- **Szczegóły**: Blok opisujący cały moduł („Wybór i kolejność wierszy licznika…") stoi **po**
  `interface MissingRow` i przed JSDoc-iem `missingCompetencies`, więc formalnie nie jest przypięty
  do żadnej deklaracji — narzędzia potraktują go jako osierocony komentarz. Najbliżsi sąsiedzi
  dokumentują moduł na górze pliku: `radar-geometry.ts:1-8`. Istnieje jednak precedens dokładnie
  tego zwisu w `team-submission.ts:11-25`, więc niezgodność jest niejednoznaczna.
- **Poprawka**: Przenieść blok `:9-22` nad `interface MissingRow`, tuż po imporcie z `@/lib/domain`.
- **Decyzja**: POMINIĘTE — świadomie. Precedens `team-submission.ts:11-25` czyni niezgodność
  niejednoznaczną, a blok jest czytelny w miejscu, w którym stoi.

## Rozważone i nieuznane za ustalenia

- **Wartości zdegenerowane w `missing`** (`NaN`, `undefined`, brak klucza): filtr `> 0`
  (`missing-competencies.ts:30`) odsiewa je wszystkie, więc zachowanie jest fail-closed — wiersz
  znika, zamiast wyrenderować „NaN points short". Producent (`evaluateTeam`) liczy `missing`
  całkowitoliczbowo w tym samym procesie klienta, bez przejścia przez sieć ani `JSON.parse`.
  Walidacja runtime byłaby kosztem bez adresata.
- **`pointsShortLabel(0)` → „0 points short"**: nieosiągalne z komponentu (filtr `> 0` stoi przed
  każdym wywołaniem, jedyny wywołujący to `MissingPointsList.tsx:38`). Gałąź obronna dołożyłaby
  nietestowaną ścieżkę zamiast usunąć ryzyko.
- **Dostępność listy** (`Below threshold` bez `aria-labelledby`, brak `aria-live`): PRD → Non-Goals
  wprost wyklucza zgodność z WCAG-AA i obsługę czytników ekranu w tym MVP. Semantyka `<ul>`/`<li>`
  i stabilny `key` są poprawne.
- **Brak `useMemo`**: świadoma decyzja planu (react-compiler; filtr nad siedmioma liczbami wobec
  budżetu NFR 200 ms). Realnego kosztu nie ma.
- **Status S-08 `proposed → in-progress` w `roadmap.md:69,340`**: plan przypisuje tę zmianę
  `/10x-implement`, nie Fazie 2 — ślad kroku otwierającego, nie rozszerzenie zakresu.

## Dyscyplina zakresu — potwierdzenie

Diff `f11ba86..HEAD` obejmuje 4 pliki kodu i 5 plików dokumentacji. Wszystkie granice „Czego NIE
robimy" utrzymane: brak solvera podpowiadającego perki, brak zmian w `CompositionGate`,
`BELOW_THRESHOLD_MESSAGE`, `src/lib/domain/`, `CompetencyRadar.tsx`, `radar-geometry.ts` i obu
stronach (zielone `git diff --quiet`), brak propa `showMissing` i trybu wyspy (grep — zero
trafień), brak testów komponentów, jsdom, snapshotów, animacji, migracji, tras API i nowych
zależności. Zero zmian EXTRA.
