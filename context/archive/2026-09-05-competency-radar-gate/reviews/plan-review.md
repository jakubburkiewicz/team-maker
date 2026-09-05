<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Wybór perków, wykres pajęczynowy i blokada progu (S-02)

- **Plan**: `context/changes/competency-radar-gate/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-05
- **Werdykt**: SOLIDNY (po sortowaniu: SOLIDNY — wszystkie ustalenia naprawione w planie)
- **Ustalenia**: 0 krytycznych, 1 ostrzeżenie, 2 obserwacje

## Werdykty

| Wymiar                       | Werdykt                                  |
| ---------------------------- | ---------------------------------------- |
| Zgodność ze stanem końcowym  | ZALICZONY                                |
| Oszczędne wykonanie          | ZALICZONY                                |
| Dopasowanie architektoniczne | ZALICZONY                                |
| Martwe punkty                | ZALICZONY                                |
| Kompletność planu            | OSTRZEŻENIE → ZALICZONY (F1–F3 naprawione) |

## Ugruntowanie

18/18 ścieżek ✓, 9/9 symboli ✓, brief↔plan ✓, Postęp↔Fazy ✓ (3 nagłówki, 4+10+10 pozycji zgodnych
z kryteriami; format identyczny z zamkniętym S-01). `docs/reference/contract-surfaces.md` nie
istnieje — sprawdzenie pominięte. Lekcja o `npx shadcn add` nie dotyczy tej zmiany (brak nowego
prymitywu).

Zweryfikowane przez podagenta (nie są ustaleniami):

- Przepis ręczny (Vesper/Torque/Sable/Wren/Oyelaran/Ghostline + „Extraction Routes" i „Service
  Tunnel Access" → `navigation`; Marlow jako drugi `combat`) zgadza się z `character-pool.ts`;
  seed SQL jest pilnowany testem `character-pool-sql.test.ts:71-75`.
- `findThresholdSolution` respektuje 2 perki/członka, brak duplikatów i ≤ 6 członków
  (`solvability.ts:72,141,144-149`); `character-pool.test.ts:77-91` dowodzi `isValid` na wyniku.
- `react-compiler: "error"`, react-hooks 7.1.1 recommended (`set-state-in-effect`),
  `strictTypeChecked` — `eslint.config.js:15,56,58`. Reguły jsx-a11y działają tylko w `.astro`.
- `RosterSlot` ma jednego konsumenta (`TeamComposer.tsx:4`); `buttonVariants` nikt nie importuje;
  `Rocket` jest w lucide-react 1.14.0.
- Zero SVG/wykresów w repo; `fill-*`/`stroke-*` z modyfikatorem krycia to standardowe utility
  Tailwind 4 (brak `tailwind.config`, tylko `@theme inline` w `global.css`).

## Ustalenia

### F1 — Umowa geometrii nie gwarantuje, że etykiety osi mieszczą się w viewBox

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 §1 (umowa `radarLayout`) i §2 (testy geometrii)
- **Szczegóły**: „Margines na etykiety" nie był parametrem ani wartością, `labelOffset` nie miał
  domyślnej, `RadarAxis.label` nie niósł `text-anchor`. Przy `size: 320` etykieta „negotiation 2"
  na lewym/prawym końcu osi wystawałaby poza `viewBox`; żadna asercja z §2 by tego nie złapała,
  choć cała wartość helpera to „SVG jest rzutem przetestowanych liczb".
- **Poprawka**: do `RadarAxis` dodać `anchor: "start" | "middle" | "end"`, do opcji `labelMargin`
  (domyślnie 56; `labelOffset` domyślnie 12), `radius = size / 2 − labelMargin`; testy: każdy
  `label` w `[0, size]`, `anchor` per strona osi; komponent przepisuje `anchor` na `textAnchor`.
- **Decyzja**: NAPRAWIONE — umowa typu, opis, testy §2 i komponent §3 w Fazie 2; brief zsynchronizowany.

### F2 — `Welcome.astro` to czwarta kopia klas CTA, a plan nazywał go nieużywanym

- **Waga**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Analiza stanu obecnego, „Czego NIE robimy", Faza 2 §4
- **Szczegóły**: `src/components/Welcome.astro:43` ma ten sam ciąg `bg-purple-600 …
  hover:bg-purple-500` i jest renderowany z `src/pages/index.astro:7` (trasa `/` nie jest
  w `PROTECTED_ROUTES`). Dług F6 to cztery kopie, nie trzy; po Fazie 2 zostaną dwie w `.astro`.
  Decyzja „wariant `cosmic` tylko dla React" jest słuszna (to `<a>`), ale `/10x-impl-review`
  zobaczyłby kopię, której plan nie wymienia.
- **Poprawka**: poprawić zdanie o `Welcome.astro` w analizie i dopisać `Welcome.astro:43` do
  „Czego NIE robimy" obok `dashboard.astro:19`.
- **Decyzja**: NAPRAWIONE — analiza stanu (dwa miejsca), „Czego NIE robimy", Faza 2 §4.

### F3 — `togglePerk` nie mówił, co zwraca dla członka spoza puli

- **Waga**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 §1 (kolejność sprawdzeń), §3 (testy)
- **Szczegóły**: Kolejność „członek w składzie → perk należy do postaci w puli → odznaczenie →
  limit" zakładała, że postać ze składu jest w puli. Skład doklejony na siłę (jak w bloku
  zgodności) może mieć `characterId` spoza puli; pod `strictTypeChecked` implementator musiałby
  zgadywać: `unknown-perk`, nowy wariant, czy rzut. `PerkRejection` jest typem publicznym z barrela.
- **Poprawka**: jedno zdanie w umowie („członek spoza puli → `unknown-perk`, bez nowego wariantu")
  i jeden przypadek testowy w §3.
- **Decyzja**: NAPRAWIONE — Faza 1 §1 i §3.
