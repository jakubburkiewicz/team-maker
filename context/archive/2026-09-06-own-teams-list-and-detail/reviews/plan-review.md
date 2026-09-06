<!-- PLAN-REVIEW-REPORT -->

# Przegląd planu: Lista własnych drużyn i widok zapisanej drużyny (S-04)

- **Plan**: `context/changes/own-teams-list-and-detail/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: DO POPRAWY → **SOLIDNY** po zastosowaniu poprawek
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje — wszystkie naprawione w planie

## Werdykty

| Wymiar                      | Werdykt (przed sortowaniem) |
| --------------------------- | --------------------------- |
| Zgodność ze stanem końcowym | ZALICZONY                   |
| Oszczędne wykonanie         | OSTRZEŻENIE                 |
| Dopasowanie architektoniczne| ZALICZONY                   |
| Martwe punkty               | OSTRZEŻENIE                 |
| Kompletność planu           | OSTRZEŻENIE                 |

## Ugruntowanie

12/12 ścieżek ✓, 9/9 symboli ✓, brief↔plan ✓, Postęp↔Faza ✓ (3 fazy, 21 punktów, zero pól wyboru
poza `## Progress`). `docs/reference/contract-surfaces.md` nie istnieje — sprawdzenie powierzchni
kontraktowych pominięte.

### Sondy weryfikacyjne (twierdzenia planu potwierdzone, nie są ustaleniami)

- **Układ tras Astro 6.3.1**: `src/pages/teams/[id].astro` obok istniejącego katalogu
  `[id]/embark.astro` **nie daje kolizji**. Manifest zbudowanego Workera układa trasy w kolejności
  `/teams/new` → `/teams/[id]/embark` → `/teams/[id]`; statyczna wygrywa, `embark` się rozwiązuje.
  Sonda uruchomiona na niechronionym mirrorze w realnym `workerd`, pliki usunięte, drzewo czyste.
- **`Intl` w `workerd`**: pełne ICU (`resolvedOptions().locale === "pl-PL"` bez fallbacku,
  `Europe/Warsaw` przelicza DST, `RelativeTimeFormat` i `NumberFormat` działają).
  `compatibility_date: "2026-05-08"`. Deterministyczne formatowanie daty we frontmatterze jest
  wykonalne dosłownie; warunek — jawnie podać i lokalizację, i `timeZone`.
- **Promień rażenia**: `TeamComposer` ma jednego importera (`src/pages/teams/new.astro:3`),
  `RosterSlot`/`RosterMember` jednego konsumenta (`TeamComposer.tsx:6,69,88`),
  `parseTeamComposition` **zero** importerów produkcyjnych spoza własnego modułu. Jedyne pominięcie
  w liście planu (`EmbarkGate.tsx` → `COMPOSITION_FIELD`) jest nieszkodliwe — plan nie rusza tej
  stałej. Żaden konsument nie zostanie zepsuty.
- **Schemat i testy**: `created_at timestamptz not null default now()` (migracja `:23`), polityka
  `select` dla właściciela (`:37-39`), `grant select` nietknięty przez `revoke` (`:46`), indeks
  `teams_user_id_idx` (`:27`). `team-schema.test.ts` asertuje na tekście migracji — plan nie dodaje
  migracji, więc nic się nie ruszy. Wydzielenie `toTeamComposition` nie łamie
  `team-submission.test.ts` pod warunkiem, że `try { JSON.parse } catch` **zostaje**
  w `parseTeamComposition` (inaczej padają przypadki z linii 64/73 i 162-167).

## Ustalenia

### F1 — Faza 2 dostarcza listę linkującą do trasy, która powstaje dopiero w Fazie 3

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 → Ręczna weryfikacja (poz. 2.5)
- **Szczegóły**: Kryterium brzmiało „kliknięcie pozycji prowadzi pod `/teams/<id>`", a
  `src/pages/teams/[id].astro` powstaje dopiero w Fazie 3 pkt 2. Na bramce ręcznego potwierdzenia
  kończącej Fazę 2 kliknięcie dałoby 404 — kryterium niezaliczalne z definicji. Zamiana kolejności
  faz nie jest wyjściem: Faza 3 linkuje „← Your teams" → `/teams`, więc zależność idzie w obie strony.
- **Poprawka**: Przeformułowano 2.5 (i odpowiadający punkt Postępu) na weryfikację samego `href`;
  przejście kliknięciem jawnie oddane Fazie 3 (pokrywają je 3.4 i 3.8).
- **Decyzja**: NAPRAWIONE

### F2 — `client:load` na ekranie, na którym z założenia nic nie jest interaktywne

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 3 pkt 2 — „sukces → `TeamComposer` z `client:load`…"
- **Szczegóły**: W trybie `readOnly` plan usuwa `MemberPickerDialog`, `EmbarkGate` i wszystkie akcje
  slotów — zostaje sam render. `useState` służy wyłącznie za wartość początkową (plan wprost tego
  wymaga: „nie przez `useEffect`"), a `CompetencyRadar` to statyczny SVG, więc komponent renderuje
  się poprawnie po stronie serwera bez dyrektywy `client:*`. Hydratacja dokładała React + domenę +
  `lucide-react` do ekranu bez ani jednej interakcji — podczas gdy plan chwali listę właśnie za to,
  że jest „czystym SSR bez `client:*`".
- **Poprawka A ⭐ Zalecana (zastosowana)**: Renderować wyspę bez `client:*`.
  - Siła: kryterium 3.5 („nie da się nic zmienić") wynika z braku runtime'u, a nie z poprawnie
    przekazanej flagi; zerowy JS na ekranie odczytu.
  - Kompromis: S-05 musi dopisać `client:load` z powrotem (jedno słowo) — zapisane w planie jako
    jawna nota dla S-05.
  - Pewność: ŚREDNIA — komponent nie ma efektów ani zdarzeń w tym trybie; render warto potwierdzić
    w `npm run dev` przed zamknięciem fazy.
  - Martwy punkt: nie sprawdzono, czy `RosterSlot` w wariancie nieinteraktywnym nie zostawi gdzieś
    `onClick` wymagającego hydratacji.
- **Poprawka B (odrzucona)**: Zostawić `client:load` i nazwać powód wprost.
  - Siła: ciągłość z S-05; ekran nie zmienia trybu renderowania między fragmentami.
  - Kompromis: bundel wyspy ładowany dla ekranu bez interakcji.
  - Pewność: WYSOKA — to dzisiejsze zachowanie `/teams/new`.
- **Decyzja**: NAPRAWIONE (Poprawka A)

### F3 — Kontrakt renderowania w trybie `readOnly` niedookreślony w trzech miejscach

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 pkt 1 — umowa `TeamComposer` / `RosterSlot`
- **Szczegóły**: Umowa mówiła, czego **nie** renderować, ale nie mówiła, co wchodzi w to miejsce.
  (1) Perki: „pokazują stan wyboru bez możliwości zmiany" jest dwuznaczne między `disabled`
  a nie-przyciskiem — i to nie jest kosmetyka: `RosterSlot.tsx:74` ma dziś
  `disabled={!selected && limitReached}`, więc zapisany członek z dwoma perkami wyrenderowałby
  trzeci jako `opacity-40`, czyli „niedostępny" zamiast „niewybrany", podczas gdy FR-014 wymaga
  odwrotnego odczytu; krok 4 testów ręcznych żąda przy tym, żeby „elementy akcji nie istniały" —
  więc `<button disabled>` też nie przechodzi. (2) Puste sloty: drużyna czteroosobowa zostawia dwa.
  (3) Licznik `Members: N/6` (`TeamComposer.tsx:82`) — zostaje czy znika.
- **Poprawka**: Umowę rozpisano na cztery podpunkty — perki jako `<li>`/`<span>` (nie `<button>`)
  z zachowanym wyróżnieniem wybranych i pełną widocznością niewybranych, bez `disabled:opacity-40`;
  puste sloty jako nieinteraktywny placeholder; brak „Remove"; licznik zostaje bez zmian.
- **Decyzja**: NAPRAWIONE

### F4 — Jedyna gałąź sygnalizująca realne rozjechanie danych jest jedyną bez logu

- **Waga**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 pkt 2 — cztery wyniki frontmattera
- **Szczegóły**: Plan przewidywał `console.error` przy błędzie odczytu drużyny i puli, ale gałąź
  „`resolveSavedTeam` odrzuca" dostawała tylko komunikat dla gracza. To odwrotnie niż powinno być:
  awaria zapytania jest przemijająca i sama się zgłosi, a odrzucenie składu oznacza rekord w bazie
  nie do złożenia z pulą — jedyny stan w tym fragmencie naprawdę wymagający diagnostyki. Konwencja
  repo jest jednoznaczna: „W Workerze log jest jedyną diagnostyką" (`new.astro:26`).
- **Poprawka**: Dopisano wymagany `console.error` z `id` drużyny i listą `violations`, wraz
  z uzasadnieniem, dlaczego akurat ta gałąź.
- **Decyzja**: NAPRAWIONE

### F5 — `teamName` w wyspie duplikuje nazwę-hash z nagłówka strony

- **Waga**: OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 3 pkt 1 (prop `teamName?: string`) vs. pkt 2 („nagłówek strony niesie nazwę-hash")
- **Szczegóły**: Ta sama nazwa-hash pojawiała się dwa razy na jednym ekranie: raz w nagłówku
  `.astro`, raz w wyspie, w dziurze po `EmbarkGate`. Prop istniał wyłącznie po to, żeby tę dziurę
  zapełnić — a S-05 wstawi tam przycisk zapisu i prop wyrzuci. Plan sam sobie postawił regułę
  „żadnych propów bez konsumenta (`teamId` w wyspie)".
- **Poprawka**: Prop usunięty z kontraktu wyspy; nazwa-hash żyje wyłącznie w nagłówku strony
  (poprawione też w „Podejściu do implementacji").
- **Decyzja**: NAPRAWIONE

## Podsumowanie sortowania

| Wynik         | Ustalenia                        |
| ------------- | -------------------------------- |
| Naprawiono    | F1, F2 (Poprawka A), F3, F4, F5  |
| Pominięto     | —                                |
| Zaakceptowano | —                                |
| Odrzucono     | —                                |

**Werdykt po poprawkach: SOLIDNY.** Rdzeń planu został zweryfikowany przeciw kodowi: odmowa zamiast
częściowego renderu naprawdę domyka lukę z przeglądu S-01 — brak `unknown-character` i `unknown-perk`
w `violations` gwarantuje, że `charactersById.get()` w wyspie nigdy nie chybi, a brak
`too-many-members` gwarantuje, że skład zmieści się w sześciu slotach.

## Konsekwencje poza tym fragmentem

Dwie poprawki zostawiają zobowiązania dla S-05 (`edit-saved-team`), oznaczone w planie jako noty:

- przywrócić `client:load` na `/teams/[id]` przy podłączaniu zapisu (F2);
- rozstrzygnąć, co wchodzi w miejsce po `EmbarkGate` w trybie edycji (F5).
