<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Wspólny nagłówek z użytkownikiem i menu nawigacyjnym na każdej stronie

- **Plan**: `context/changes/2026-09-06-app-shell-header-nav/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: DO POPRAWY → **SOLIDNY** (po zastosowaniu wszystkich siedmiu poprawek)
- **Ustalenia**: 2 krytyczne, 3 ostrzeżenia, 2 obserwacje — wszystkie naprawione

## Werdykty

| Wymiar | Werdykt (przed) | Werdykt (po poprawkach) |
|-----------|---------|---------|
| Zgodność ze stanem końcowym | OSTRZEŻENIE | ZALICZONY |
| Oszczędne wykonanie | ZALICZONY | ZALICZONY |
| Dopasowanie architektoniczne | OSTRZEŻENIE | ZALICZONY |
| Martwe punkty | NIEZALICZONY | ZALICZONY |
| Kompletność planu | NIEZALICZONY | ZALICZONY |

## Ugruntowanie

8/8 istniejących ścieżek ✓ (3 nowe pliki zgodnie z planem), 4/4 symboli ✓, Progress↔Faza ✓, brief↔plan ✓.
Drobiazg bez wpływu: „trzynaście odwołań w sześciu plikach" — faktycznie 13 `href` w siedmiu plikach.
Poboczne odkrycie spoza zakresu: `src/components/ui/LibBadge.astro` jest już dziś osierocony i lint
tego nie wykrywa — twierdzenie planu o niewykrywalności martwych `.astro` ma w repo dowód istnienia.

## Ustalenia

### F1 — Wymaganie wstępne jest niezaplanowane, a plan nie ma bramki

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 1 (brak kryterium wstępnego), Faza 2 pkt 4, Faza 3 pkt 1
- **Szczegóły**: `2026-09-06-teams-list-as-home` ma `status: new` i tylko `change.md` — nie ma nawet
  `plan.md`. Uruchomiony dziś `/10x-implement`: Faza 2 pkt 4 kasuje `Topbar.astro`, gdy
  `src/components/Welcome.astro:2` wciąż go importuje (build czerwony); Faza 3 pkt 1 opisuje treść,
  której nie ma w `src/pages/index.astro`; `/` niosłoby dwa nagłówki; `src/pages/dashboard.astro`
  i `src/pages/teams/index.astro` są konsumentami `Layout.astro` poza oboma koszykami planu.
- **Poprawka**: Uruchamialne kryterium wstępne 1.1 w Fazie 1 + akapit „Bramka" w Analizie stanu obecnego.
  Kotwica na symbolu `listTeams` w `index.astro` zamiast na `PROTECTED_ROUTES` — wymaganie wstępne
  zapowiada „osobne dopasowanie dokładne", więc literał `"/"` może się tam nie pojawić.
- **Decyzja**: NAPRAWIONE

### F2 — Umowa kontenera `AppLayout` nie obsługuje wyśrodkowanych kart

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 pkt 2, konsumowane przez Fazę 2 pkt 3 i Fazę 3 pkt 4
- **Szczegóły**: Umowa opisywała kontener górno-wyrównany (`bg-cosmic min-h-screen p-4` +
  `mx-auto max-w-*`) z jednym propem szerokości. Ale `TeamNotFound.astro:24` i `embark.astro:57`
  to karty wyśrodkowane — a `TeamNotFound` jest pierwszym konsumentem już w Fazie 2. Zweryfikowane
  konsekwencje: wysokość dokumentu `headerH + 100vh` → stały martwy pasek przewijania na każdym
  ekranie powłoki; utrata wyśrodkowania; `bg-cosmic` (`global.css:113-115`) daje tylko
  `background-image`, więc nagłówek nad kontenerem maluje się na `bg-background` — widoczny szew.
- **Poprawka A ⭐ Zalecana**: Powłoka nie wnosi kontenera treści — `bg-cosmic flex min-h-screen flex-col`
  + nagłówek + slot w `flex-1`; strony zachowują swoje kontenery, `min-h-screen` → `flex-1`.
  - Siła: zero propów do zgadnięcia; Faza 3 kurczy się do importu + wycięcia linków; szew tła znika.
  - Kompromis: powtórzone `mx-auto max-w-*` zostaje w stronach — deduplikacji nie obiecywało żadne Kryterium sukcesu.
  - Pewność: WYSOKA — kształt zweryfikowany na wszystkich pięciu plikach.
  - Martwy punkt: `flex-1` do potwierdzenia wzrokowo → nowy krok ręczny 2.12.
- **Poprawka B**: Kontener w powłoce z propem trybu `"page" | "card"` zamiast szerokości.
  - Siła: kontener przestaje być powtarzany.
  - Kompromis: prop trybu to cichy przełącznik, przed którym plan sam ostrzega.
  - Pewność: ŚREDNIA.
  - Martwy punkt: kolejność klas przy `prettier-plugin-tailwindcss`.
- **Decyzja**: NAPRAWIONE za pomocą poprawki A

### F3 — Kryteria 2.12 i 3.15 przeczą krokowi 6 testowania ręcznego

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: Progress 2.12 i 3.15 vs. „Kroki testowania ręcznego" pkt 6
- **Szczegóły**: Kryteria mówiły „`Sign out` … ląduje na `/`". `signout.ts:9` celuje w `/`, a `/`
  wchodzi po wymaganiu wstępnym do `PROTECTED_ROUTES` — middleware odbija na `/auth/signin`.
  Krok 6 tej samej sekcji mówi to wprost; kryteria mu przeczyły.
- **Poprawka**: Przeformułowane na przekierowanie `/` → `/auth/signin`, w blokach Faz i w Progress.
- **Decyzja**: NAPRAWIONE

### F4 — Strażnik propsów trafi w komentarz, który plan sam każe przepisać

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2, kryterium „Ekran 404 nadal nie przyjmuje propsów"
- **Szczegóły**: `! grep -n 'Astro.props' src/components/team/TeamNotFound.astro` kotwiczy na słowie,
  a ten sam punkt planu poleca przepisać komentarz w liniach 4-8. Klasa z `lessons.md` →
  „Kryteria grepowe kotwicz na składni, nie na słowach — komentarze też są w pliku".
- **Poprawka**: Wzorzec strzygący komentarze
  (`! grep -vE '^\s*(//|\*|/\*)' … | grep -q 'Astro\.props'`) + zakaz literału `Astro.props`
  w przepisanym komentarzu. **Przesondowane** na kopii poza repozytorium: wariant literalny czerwieni
  się fałszywie po wzmiance w komentarzu, nowy przechodzi zielono i nadal czerwieni się na realnym propie.
- **Decyzja**: NAPRAWIONE

### F5 — Nic nie wiąże `AppHeader` z `@/lib/nav`

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2, kryteria automatyczne
- **Szczegóły**: Jedyna testowana reguła zmiany mogła zostać w ogóle niepodłączona — `AppHeader.astro`
  z wpisanymi na sztywno adresami i własnym `startsWith` przechodził komplet kryteriów na zielono,
  a `nav.test.ts` wiązałby wtedy martwy moduł. Klasa „strażnik nieprzesondowany jest dekoracją".
- **Poprawka**: Dwa nowe kryteria (2.3 pozytywne — import z `@/lib/nav`; 2.4 negatywne — brak
  literalnych `href` w markupie nagłówka, wzorzec strzyże komentarze). **Przesondowane** na
  syntetycznym nagłówku: zielone dla `<a href={item.href}>` nad `NAV_ITEMS`, czerwone po wpisaniu
  `href="/teams/new"` na sztywno.
- **Decyzja**: NAPRAWIONE

### F6 — `cn()` w `.astro` nie ma w tym repo precedensu

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 2 pkt 1
- **Szczegóły**: Wszystkie osiem wywołań `cn()` siedzi w `.tsx`; każdy `.astro` używa literalnego
  `class="…"`. Astro ma formę natywną (`class:list`), a `eslint.config.js:67` włącza
  `astro/prefer-class-list-directive` w tę stronę. `AGENTS.md` mówi jednak wprost „Merge Tailwind
  classes with `cn()`". Wybór planu jest obronny — brakowało nazwania kompromisu.
- **Poprawka**: Akapit „Nazwany kompromis" w umowie Fazy 2 pkt 1 (reguła jest **warnem**, `eslint .`
  nie kończy się błędem na warnach, więc CI zostaje zielone) plus zapis, że `aria-current` przechodzi
  `flat/jsx-a11y-recommended` czysto (sprawdzone `eslint --stdin`; precedens `Layout.astro:29`).
- **Decyzja**: NAPRAWIONE

### F7 — Mapa drogowa nie zna tej zmiany, a plan tylko to odnotowuje

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Analiza stanu obecnego → Kluczowe odkrycia
- **Szczegóły**: Plan stwierdzał „synchronizacja statusu roadmapy została pominięta" i na tym
  poprzestawał. M-1 jest zamknięty (S-01…S-08 `done`), więc ta zmiana i dwie siostrzane są
  poprawkami po kamieniu milowym, poza roadmapą.
- **Poprawka**: Notatka zamieniona na jawne rozstrzygnięcie — brak pozycji jest zamierzony;
  właściwym krokiem dla planu produktu jest otwarcie M-2 przez `/10x-roadmap`, nie dopisanie
  wiersza do zamkniętego kamienia milowego.
- **Decyzja**: NAPRAWIONE
