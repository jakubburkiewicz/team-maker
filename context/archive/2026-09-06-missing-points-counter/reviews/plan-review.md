<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Licznik brakujących punktów (S-08)

- **Plan**: `context/changes/missing-points-counter/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: SOLIDNY
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 1 obserwacja
- **Werdykt po poprawkach**: SOLIDNY (4/4 ustalenia naprawione w planie)

## Werdykty

| Wymiar | Werdykt |
| --- | --- |
| Zgodność ze stanem końcowym | OSTRZEŻENIE → ZALICZONY po F2 |
| Oszczędne wykonanie | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY |
| Martwe punkty | OSTRZEŻENIE → ZALICZONY po F3 |
| Kompletność planu | OSTRZEŻENIE → ZALICZONY po F1 i F4 |

## Ugruntowanie

11/11 ścieżek ✓, 12/12 kotwic plik:linia ✓ (`evaluate-team.ts:36`, `:24-33`, `:109-119`,
`TeamComposer.tsx:127`/`:130`, `CompositionGate.tsx:68`, `team-submission.ts:40`,
`CompetencyRadar.tsx:21`, `RosterSlot.tsx:69`/`:77`, `new.astro:49`, `[id].astro:132`,
cztery asercje `evaluate-team.test.ts:49/65/72/82`), brief↔plan ✓,
Progress↔Faza ✓ (2 fazy, 26 pozycji po poprawkach, numeracja ciągła),
promień rażenia ✓ (`evaluation.missing` ma zero konsumentów w całym `src/`;
`TeamComposer` renderowany wyłącznie przez `new.astro` i `[id].astro`),
komendy grepowe i gitowe przesondowane dosłownie na żywym repo ✓
(pathspec `:(literal)` działa, `\s` działa w ugrep 7.8.4, kryterium 2.2 wypisuje `1`).

## Ustalenia

### F1 — Kryterium 2.2 nie było zakotwiczone na składni; filtr komentarzy nie łapie wnętrza bloku `{/* … */}`

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 → kryteria automatyczne, poz. 2.2; „Krytyczne szczegóły implementacji"
- **Szczegóły**: Filtr `^\s*(//|\*|/\*|\{/\*)` odsiewa linie `{/*` i `*/}`, ale nie linie
  kontynuacji 123–125 w `TeamComposer.tsx` — to czysta proza bez znacznika, opisująca dokładnie
  ten warunek. Kryterium wypisywało `1` tylko dlatego, że autor komentarza akurat nie zapisał
  warunku kodem. `lessons.md` §„Kryteria grepowe kotwicz na składni, nie na słowach" stawia odsiew
  komentarzy jako wyjście awaryjne na wypadek braku kotwicy — a tu kotwica istnieje.
- **Poprawka**: Kryterium 2.2 zakotwiczone na składni otwarcia gałęzi JSX:
  `grep -cE '^\s*\{evaluation\.violations\.length === 0 \?' src/components/team/TeamComposer.tsx`
  musi wypisać `1`. Dyscyplina komentarza („warunek prozą, nie kodem") zostaje jako druga warstwa,
  nie jako jedyna ochrona. Zaktualizowano też „Krytyczne szczegóły implementacji", opis Fazy 2
  pkt 2, tytuł 2.2 w Progress i zapis ryzyka w `plan-brief.md`.
- **Decyzja**: NAPRAWIONE

### F2 — Przeformułowanie komunikatu awaryjnego było jedynym deliverable bez żadnego kryterium

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność ze stanem końcowym (luka w obietnicy)
- **Lokalizacja**: Faza 2 → „Wspólna gałąź w wyspie"; `plan-brief.md` → Zakres
- **Szczegóły**: Plan wymaga przeformułowania „so the chart cannot be shown", bo warunek chroni
  teraz dwa elementy, a brief wymienia to w Zakresie. Żadne z 15 kryteriów Fazy 2 tego nie
  dotykało. Gałąź awaryjna jest nieosiągalna z interfejsu (skład powstaje wyłącznie przez
  `roster.ts`, dowód `roster.test.ts`), więc żaden krok ręczny jej nie zobaczy, a kryterium 2.2
  liczy sam warunek, nie tekst pod nim. Jedyny punkt planu, który mógł zostać cicho pominięty
  i przejść na zielono.
- **Poprawka**: Dodano kryterium automatyczne 2.8 —
  `! grep -F 'so the chart cannot be shown' src/components/team/TeamComposer.tsx`;
  kryteria ręczne przenumerowane na 2.9–2.15 w treści i w Progress.
- **Decyzja**: NAPRAWIONE

### F3 — Liczba gramatyczna była jedyną regułą prezentacyjną bez dowodu w CI

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 → „Komponent listy"; Strategia testowania
- **Szczegóły**: Plan wyprowadzał do testowalnego helpera odsiew i kolejność, obie z kontrolą
  mutacyjną — i zostawiał w komponencie trzecią regułę: „1 point short" / „N points short".
  Repozytorium nie ma testów komponentów React, więc jej jedynym dowodem był krok ręczny. Ta sama
  Strategia testowania cytuje `lessons.md` §„asercja bez kontroli mutacyjnej jest dekoracją" —
  a tu nie było nawet asercji.
  - Siła poprawki: trzecia reguła fragmentu dostaje ten sam rodzaj dowodu co dwie pozostałe,
    bez jsdom i bez zależności; koszt ~6 linii kodu i ~8 linii testu.
  - Kompromis: napis interfejsu wjeżdża do `src/lib/` (precedens: `BELOW_THRESHOLD_MESSAGE`
    w `src/lib/team-submission.ts:40`).
  - Pewność: WYSOKA — oba precedensy (`radar-geometry.ts`, `BELOW_THRESHOLD_MESSAGE`) sprawdzone
    w repozytorium.
  - Martwy punkt: nie zweryfikowano, czy przegląd implementacji nie uzna napisu w `src/lib/`
    za rozjazd konwencji — to jest właśnie ten przyjęty kompromis.
- **Poprawka**: Drugi eksport helpera `pointsShortLabel(missing: number) → string`; przypadki
  testowe 7 i 8; kontrola mutacyjna C (usunięcie gałęzi liczby pojedynczej czerwieni przypadek 7)
  jako nowe kryterium 1.6, kryteria 1.6–1.10 przenumerowane na 1.7–1.11; kryterium 1.3 podniesione
  z sześciu do ośmiu przypadków; komponent bierze napis z helpera zamiast rozgałęziać się sam.
- **Decyzja**: NAPRAWIONE

### F4 — Nazwa funkcji i typu helpera nie padała w plan.md

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 → „Helper wyboru wierszy" → Umowa
- **Szczegóły**: Umowa opisywała kształt, ale nie nazywała ani funkcji, ani typu. Nazwa
  `missingCompetencies` padała wyłącznie w diagramie `plan-brief.md`, a `/10x-implement` pracuje
  z `plan.md`.
- **Poprawka**: Nazwy wpisane wprost: typ `MissingRow`, funkcje `missingCompetencies()`
  i `pointsShortLabel()`, eksport `MissingPointsList` z propem `missing`; użyte spójnie w opisie
  Fazy 2.
- **Decyzja**: NAPRAWIONE
