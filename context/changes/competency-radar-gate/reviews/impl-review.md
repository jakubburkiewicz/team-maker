<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Wybór perków, wykres pajęczynowy i blokada progu (S-02)

- **Plan**: `context/changes/competency-radar-gate/plan.md`
- **Zakres**: Fazy 1–3 z 3 (pełny przegląd planu; commity ef831bb, 870654a, c89f0da)
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANO (po sortowaniu: F1 i F2 naprawione; lint + 82 testy przechodzą)
- **Ustalenia**: 0 krytycznych, 0 ostrzeżeń, 2 obserwacje

## Werdykty

| Wymiar                  | Werdykt                    |
| ----------------------- | -------------------------- |
| Zgodność z planem       | PASS                       |
| Dyscyplina zakresu      | PASS                       |
| Bezpieczeństwo i jakość | WARNING (1 obserwacja, F2) |
| Architektura            | PASS                       |
| Spójność wzorców        | WARNING (1 obserwacja, F1) |
| Kryteria sukcesu        | PASS                       |

## Ugruntowanie

Pod-agenty (odchylenia od planu; bezpieczeństwo/wzorce) padły na limicie sesji API przed
zgłoszeniem wyników — przegląd wykonany bezpośrednio w głównym kontekście na wszystkich 13
zmienionych plikach źródłowych.

**Zgodność z planem — 16/16 plików z planu w diffie, 0 plików poza planem.** Sprawdzone
umowa-po-umowie:

- `roster.ts` — `togglePerk` z kolejnością sprawdzeń członek → perk w puli → odznaczenie → limit;
  członek spoza puli → `unknown-perk` (F3 z przeglądu planu); pozostali członkowie zachowują
  referencje (`candidate === member`); komentarz `addMember` wskazuje na `togglePerk`. MATCH.
- `index.ts` — `togglePerk`, `PerkRejection`, `TogglePerkResult` w barrelu. MATCH.
- `roster.test.ts` — wszystkie 9 przypadków `describe("togglePerk")` i 4 przypadki zgodności
  z `evaluateTeam` (w tym `findThresholdSolution` odtworzone przez pisarzy); progi literałami `2`,
  identyfikatory z `POOL_IDS`/`perkIdsOf`. MATCH.
- `radar-geometry.ts` / `.test.ts` — umowa typów 1:1, −90° start, zegarowo, `radius = size/2 −
  labelMargin` (56/12), `anchor` ze znaku cosinusa z ε, `max(2×próg, …)`, gałąź `max === 0` bez
  dzielenia przez zero; testy pokrywają każdy punkt z §2 plus próg 0. MATCH.
- `CompetencyRadar.tsx` — `role="img"` + `aria-label` z siedmioma sumami, klasy palety cosmic
  dokładnie jak w umowie, `textAnchor={axis.anchor}`, zero obliczeń w komponencie. MATCH.
- `button.tsx` / `SubmitButton.tsx` / `MemberPickerDialog.tsx` — wariant `cosmic` z dokładnym
  ciągiem; obie kopie przeszły na wariant zachowując tylko `w-full` / `mt-6 w-full`; usunięte
  `px-4 py-2 font-medium transition-colors` są w bazie `buttonVariants` (`font-medium transition-all`,
  size default `h-9 px-4 py-2`) — wygląd bez zmian. `dashboard.astro:19` i `Welcome.astro:43`
  nietknięte. MATCH.
- `EmbarkGate.tsx` — `type="button" variant="cosmic" disabled={!ready} aria-describedby`, oba
  teksty literalnie z planu, `COMPETENCY_THRESHOLD` w tekście, bez `onClick`. MATCH.
- `TeamComposer.tsx` — `evaluateTeam` przy renderze bez memo/efektów; grid
  `lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`; `<aside>` „Competencies"; wykres tylko przy pustym
  `violations` z komentarzem wskazującym umowę; funkcyjne `setComposition` zwracające `current` przy
  odrzuceniu; `slots` → `RosterMember | null`. MATCH.
- `RosterSlot.tsx` — `RosterMember` eksportowany, props zgodne, `aria-pressed`, `disabled={!selected
  && limitReached}`, klasy stanu wybranego jak w oknie, „Perks N/2", „Remove" bez zmian. MATCH.
- `new.astro` — `max-w-4xl` → `max-w-6xl`. MATCH. `roadmap.md` § S-02 — Niewiadoma rozstrzygnięta
  dosłownie wg umowy. MATCH.

**Dyscyplina zakresu** — `evaluation.missing` nieużywane; przycisk bez handlera; okno wyboru bez
przełączników; zero bibliotek wykresów; brak `--chart-*`/`.dark`; brak testów jsdom;
`package.json`/`package-lock.json` bez zmian od be2cc86. Nic poza planem.

**Bezpieczeństwo** — brak nowej powierzchni API i zapisu; wszystkie treści (nazwy postaci, perków,
sumy) przechodzą przez JSX/atrybuty SVG jako liczby lub escapowane teksty — brak XSS; brak sekretów.

**Kryteria sukcesu** — uruchomione na Node 22.14.0:

| Kryterium                                              | Wynik                                              |
| ------------------------------------------------------ | -------------------------------------------------- |
| 1.1 / 2.1 / 3.2 `npm test`                             | ✅ 7 plików, 82 testy, 330 ms                      |
| 1.2 / 2.2 / 3.1 `npx astro sync && npm run lint`       | ✅ exit 0 (tylko ostrzeżenia parsera `projectService`) |
| 1.3 czystość `src/lib/domain/`                         | ✅ grep pusty                                       |
| 2.3 / 3.3 `npm run build`                              | ✅ „Complete!" (ostrzeżenie `sitemap`/`site` przedistniejące) |
| 2.4 / 3.4 `git diff --quiet be2cc86 HEAD -- package*`  | ✅ exit 0                                           |
| 2.5 `bg-purple-600` w `SubmitButton` / `MemberPickerDialog` | ✅ 0 / 0 (pozostałe: `button.tsx` wariant, dwa `.astro` — planowane) |
| 1.4 kontrola mutacyjna `MAX_PERKS_PER_MEMBER = 3` (ręczne, odtworzone) | ✅ 3 testy padają (limit 2, zgodność, too-many-perks); drzewo przywrócone |
| 2.6–2.10, 3.5–3.10 (ręczne, ekranowe)                  | ⏳ oznaczone `[x]` z SHA; kod pokrywa każdy krok — brak sprzeczności w źródle |

## Ustalenia

### F1 — Podpis punktacji na karcie slotu powtarza nazwę kompetencji i różni się od okna wyboru

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/team/RosterSlot.tsx:56-61
- **Szczegóły**: Wiersz specjalizacji renderuje `{character.specialization}` a zaraz obok podpis
  `+{SPECIALIZATION_POINTS} {character.specialization}` — na ekranie (z `uppercase`) czyta się
  „COMBAT +2 COMBAT". Implementacja jest literalnie zgodna z planem (§Faza 3 pkt 1: „podpis
  `+2 {competency}`"), więc to wada planu, nie odchylenie. Ten sam fakt okno wyboru
  (`MemberPickerDialog.tsx:107`) podpisuje „+2 points", a perki na obu powierzchniach „+1" —
  karta jest jedynym miejscem z inną konwencją.
- **Poprawka**: Zmień podpis na karcie na `+{SPECIALIZATION_POINTS} points` (jak w oknie) albo na
  samo `+{SPECIALIZATION_POINTS}` (jak przy perkach); wymóg planu „literał z
  `SPECIALIZATION_POINTS`" zostaje spełniony.
- **Decyzja**: NAPRAWIONE — podpis na karcie zmieniony na `+{SPECIALIZATION_POINTS} points`
  (`RosterSlot.tsx:58`), spójnie z oknem wyboru.

### F2 — Gwarancja „etykieta zawsze w viewBox" ma niezapisany warunek `labelOffset ≤ labelMargin`

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/radar-geometry.ts:36-46
- **Szczegóły**: Umowa z planu (i test `radar-geometry.test.ts:146`) obiecuje, że każdy `label`
  leży w `[0, size]`, ale `radarLayout` niczego nie sprawdza ani nie ogranicza: punkt etykiety leży
  w odległości `radius + labelOffset = size/2 − labelMargin + labelOffset` od środka, więc własność
  zachodzi tylko gdy `labelOffset ≤ labelMargin`. Domyślne 12 ≤ 56 spełnia ją, a jedyny konsument
  (`CompetencyRadar`) używa domyślnych — dziś nie ma błędu. Przyszły wywołujący podający
  `labelMargin: 8` bez zmiany `labelOffset` dostanie etykiety poza `viewBox` i żaden test tego nie
  złapie (test sprawdza tylko domyślne).
- **Poprawka**: Jedna linia JSDoc przy `RadarLayoutOptions.labelOffset`: „musi być ≤ `labelMargin`,
  inaczej etykieta wychodzi poza `viewBox`" — dokumentuje warunek wstępny bez dokładania walidacji
  do czystego helpera.
- **Decyzja**: NAPRAWIONE — JSDoc `RadarLayoutOptions.labelOffset` nazywa warunek
  `labelOffset ≤ labelMargin` i wzór na odległość etykiety (`radar-geometry.ts:41-44`).
