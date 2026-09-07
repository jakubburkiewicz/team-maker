<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Bariera serwerowa zapisu drużyny

- **Plan**: `context/changes/2026-09-07-testing-save-barrier/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-07
- **Werdykt**: DO POPRAWY → **SOLIDNY** (po sortowaniu; wszystkie siedem ustaleń naprawione)
- **Ustalenia**: 2 krytyczne, 4 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt (przed) | Po poprawkach |
|-----------|---------|---------|
| Dopasowanie do stanu końcowego | NIEZALICZONY | ZALICZONY |
| Oszczędna realizacja | ZALICZONY | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY | ZALICZONY |
| Martwe punkty | OSTRZEŻENIE | ZALICZONY |
| Kompletność planu | NIEZALICZONY | ZALICZONY |

## Ugruntowanie

8/8 ścieżek ✓ (`scripts/` jeszcze nie istnieje — zgodnie z planem), 6/6 symboli ✓, brief↔plan ✓.
Baza `a392c62` potwierdzona uruchomieniem: 17 plików / 193 testy. Niezależnie przesondowane:
`await import("@/pages/api/teams/[id]")` **rozwiązuje się** w Vitest przy aliasie `@`
z `vitest.config.ts` — mechanizm Fazy 2 działa, nawiasy kwadratowe nie są problemem.

## Ustalenia

### F1 — Kanoniczna mutacja sondy nieokreślona, nieprzesondowana; uzasadnienie opiera się na bramce, której CI nie uruchamia

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Dopasowanie do stanu końcowego
- **Lokalizacja**: „Krytyczne szczegóły implementacji", Faza 1 pkt 2, kryterium 1.9
- **Szczegóły**: (a) plan mianuje kanoniczną mutacją przestawienie `createTeam` przed bramkę, ale
  jedynym wariantem faktycznie przesondowanym było usunięcie `if (!gate.ok)`; (b) to nie jest
  przestawienie — `createTeam` konsumuje `gate.composition`, którego przed bramką nie ma
  (`src/pages/api/teams/index.ts:72`), więc mutacja wymaga nowego kodu, a plan nie podawał ani
  jednej linii łatki dla skryptu bash; (c) argument „usunięcie warunku i tak łapie `astro check`"
  nie stoi: `.github/workflows/ci.yml:18-21` uruchamia `astro sync`, `lint`, `test`, `build`,
  `astro build` nie typuje, a `astro check` nie jest ani krokiem CI, ani skryptem npm.
- **Poprawka A ⭐ Zalecana**: mutacja jako wersjonowany `scripts/probe-save-barrier.patch`
  (`git apply` / `git apply -R`), z treścią hunka wpisaną do planu; teza o `astro check` usunięta.
  - Siła: łatka recenzowalna, cofnięcie dokładne, rozjazd z `index.ts` głośny zamiast cichego.
  - Kompromis: łatka wymaga odświeżenia przy refaktorze `index.ts`.
  - Pewność: WYSOKA — typowo poprawny wariant bez nowych importów istnieje i jest zapisany.
  - Martwy punkt: zachowanie `git apply` na drzewie z niezacommitowanym `plan.md` niesprawdzone.
- **Poprawka B**: sonda nakłada oba warianty i wymaga czerwieni z każdego.
- **Decyzja**: NAPRAWIONE (Poprawka A)

### F2 — `## Progress` nie odpowiada kryteriom sukcesu w Fazach 3 i 4

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 (weryfikacja ręczna), Faza 4 (weryfikacja automatyczna)
- **Szczegóły**: 3.10 istniało w Progress bez źródłowego punktu; punkt Fazy 4 o czerwieni §1/§7
  nie miał wpisu w Progress i stał w sekcji automatycznej mimo ręcznego charakteru; Faza 4 pkt 3
  (`change.md` → `status: complete`) nie miała żadnego kryterium.
- **Poprawka**: dopisany punkt ręczny Fazy 3, punkt §1/§7 przeniesiony do weryfikacji ręcznej
  (4.10), dodane kryteria na `change.md` i na wiersz §4; cały Progress przenumerowany.
  Weryfikacja mechaniczna po poprawce: 8/8, 5/5, 6/6, 7/7 automatycznych i 4/4 ręcznych w każdej
  fazie, zero checkboxów poza Progress, jeden nagłówek `## Progress`.
- **Decyzja**: NAPRAWIONE

### F3 — Teksty odmowy asercjonowane w Fazach 2–3 nie są eksportowane i przy tym zakresie nie mogą być

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 pkt 3, Faza 3 pkt 1 i 3
- **Szczegóły**: eksportowane są dokładnie dwie stałe (`src/lib/team-submission.ts:40,43`).
  `SAVE_FAILED_MESSAGE` jest prywatną stałą `src/pages/api/teams/[id].ts:31`, a „Supabase is not
  configured" i „Character pool is unavailable" to literały w ciele obu tras. Faza 2 żądała stałych
  „importowanych, nie przepisanych", a zakres zabrania zmian w `src/pages/` — sprzeczność.
- **Poprawka A ⭐ Zalecana**: plan nazywa te trzy teksty świadomą drugą kopią literału; kryterium
  komunikatów zawężone do dwóch faktycznie eksportowanych stałych. Zero zmian w produkcie.
  - Siła: faza zostaje czysto testowa, jak deklaruje.
  - Kompromis: zmiana tekstu w trasie rozjedzie się z testem (złapie ją czerwień, po fakcie).
  - Pewność: WYSOKA — `grep` po `export const .*MESSAGE` w całym `src/` daje dokładnie dwa trafienia.
  - Martwy punkt: brak znaczących.
- **Poprawka B**: wynieść trzy teksty do `@/lib/team-submission` — odrzucona jako poszerzenie zakresu.
- **Decyzja**: NAPRAWIONE (Poprawka A)

### F4 — Kontrakt „ta sama odpowiedź, znakowo równa" dla nie-UUID był niespełnialny

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 pkt 3
- **Szczegóły**: `reject()` wkleja identyfikator do ścieżki (`src/pages/api/teams/[id].ts:40,47`),
  więc `Location` dla nie-UUID i dla poprawnego UUID-a nigdy nie będzie znakowo równy. Własność
  US-04, która ma znaczenie, porównuje dwa **poprawne** UUID-y: własny nieistniejący i cudzy
  odcięty przez RLS — oba wracają z repo jako `null` bez `error`.
- **Poprawka**: kontrakt rozdzielony na dwa przypadki — znakowa równość komponentu `?error=` dla
  dwóch poprawnych UUID-ów; nie-UUID jako osobny przypadek „zero wywołań klienta, bez `throw`".
- **Decyzja**: NAPRAWIONE

### F5 — Limity liczone raz na pięć, raz na sześć; wyłączenie zakresu czytało się jak zakaz dwóch rodzajów

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: „Analiza bieżącego stanu", „Czego NIE robimy", Faza 2 pkt 2, kryterium 2.11
- **Szczegóły**: `RuleViolation` ma sześć wariantów (`src/lib/domain/evaluate-team.ts:15-21`).
  Plan pisał „sześć" w analizie stanu, a „pięć" w stanie końcowym, briefie i Fazie 2. Osobno:
  „Nie domykamy dwóch luk `gateTeamSubmission`" czytało się jak wyłączenie `duplicate-character`
  i `unknown-perk` z zakresu, choć `research.md:180-184` mówi o brakujących przypadkach
  jednostkowych w `src/lib/team-submission.test.ts`, nie o dziurach w bramce.
- **Poprawka**: ujednolicono na sześć rodzajów w planie i briefie; wyłączenie przepisane na
  „nie dopisujemy przypadków do `src/lib/team-submission.test.ts`" z jawnym zdaniem, że na poziomie
  trasy oba rodzaje są w zakresie.
- **Decyzja**: NAPRAWIONE

### F6 — Cztery kryteria „automatyczne" nie przechodziły dosłownie albo mierzyły nie to, co deklarują

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: kryteria 1.5, 1.10/1.11, 2.2, 2.3
- **Szczegóły**: `git diff --stat` kończy się `0` niezależnie od wyniku; `grep -c` liczy linie,
  więc dwa importy `index` domykały próg ≥2 bez ani jednego załadowania `[id]`; „wzrost o ≥ 11
  wobec 193" wymagał arytmetyki człowieka i był progiem nad liniami; `git status --porcelain`
  całego drzewa padłby przy poprawnym przebiegu, bo `plan.md` niesie odhaczony Progress, a plik
  testowy jest nowy. Wszystkie cztery to `lessons.md` §„Strażnik musi mierzyć to, co deklaruje".
- **Poprawka**: `git diff --quiet a392c62 -- …`; licznik dynamicznych importów skreślony na rzecz
  asercji tabeli i ręcznego 2.9; kardynalność związana w teście
  (`expect(VIOLATION_CASES).toHaveLength(6)`, `expect(SAVE_ROUTES).toHaveLength(2)`);
  `git status --porcelain src/pages/api/teams/` zamiast całego drzewa (w kryteriach, w krokach
  ręcznych i w Progress).
- **Decyzja**: NAPRAWIONE

### F7 — Trzy szczegóły rozjechane ze stanem na dysku

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 pkt 1.2, Faza 4 pkt 2
- **Szczegóły**: Faza 4 zakładała przejście `researched` → `complete`, a wiersz §3 czyta już
  `planned` i orkiestrator przesunie go jeszcze na `implementing`; kontrakt atrapy podawał
  `.update().select().eq().maybeSingle()`, a prawdziwy łańcuch to `.update().eq().select().maybeSingle()`
  (`src/lib/team-repo.ts:127-131`); aktualizacja wiersza §4 nie miała kryterium.
- **Poprawka**: przejście statusu zapisane jako „→ `complete`, niezależnie od stanu pośredniego";
  kolejność łańcucha poprawiona z kotwicami plik:linia dla obu repo; dodane kryterium 4.4 na §4.
- **Decyzja**: NAPRAWIONE
