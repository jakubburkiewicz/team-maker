<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Kompletowanie składu drużyny z okna wyboru członka (S-01)

- **Plan**: `context/changes/team-roster-composition/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-05
- **Werdykt**: DO POPRAWY (przed sortowaniem) → SOLIDNY (po zastosowaniu F1–F4)
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar                       | Werdykt                    |
| ---------------------------- | -------------------------- |
| Zgodność ze stanem końcowym  | OSTRZEŻENIE                |
| Oszczędne wykonanie          | ZALICZONY                  |
| Dopasowanie architektoniczne | ZALICZONY                  |
| Martwe punkty                | OSTRZEŻENIE                |
| Kompletność planu            | ZALICZONY (2 obserwacje)   |

## Ugruntowanie

22/22 ścieżek ✓, 7/7 symboli ✓ (`MAX_TEAM_SIZE`, warianty `violations` w `evaluateTeam`,
`PROTECTED_ROUTES`, null-check `createClient`, throw w `getCharacterPool`,
`CHARACTER_POOL: readonly PoolCharacter[]`, przypisywalność `PoolCharacter[]` → `CharacterPool`),
brief↔plan ✓, Postęp↔Fazy ✓ (1.1–1.5, 2.1–2.6, 3.1–3.11 mapują 1:1 na kryteria sukcesu).
Plan nie modyfikuje istniejących symboli poza tablicą `PROTECTED_ROUTES` — promień rażenia
zerowy; twierdzenia zweryfikowane bezpośrednio w kodzie zamiast podagentem.

## Ustalenia

### F1 — Krok weryfikacji stanu błędu nigdy nie dociera do karty błędu

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 → Ręczna weryfikacja (2.6); Strategia testowania → krok 6
- **Szczegóły**: Plan każe sprawdzić kartę błędu przez usunięcie `SUPABASE_URL`/`SUPABASE_KEY`
  z `.env`. Bez tych zmiennych middleware dostaje `createClient() === null`, ustawia
  `locals.user = null` (`src/middleware.ts:14-15`) i przekierowuje każdą trasę z prefiksem
  `/teams` na `/auth/signin` (`:18-21`) — frontmatter `new.astro` nigdy się nie wykona. Ten
  sam mechanizm czyni gałąź `supabase === null` w stronie nieosiągalną (zostaje jako twarda
  reguła AGENTS.md — obrona w głąb). Jedyna realnie osiągalna ścieżka błędu — throw
  z `getCharacterPool` — nie ma żadnego kroku weryfikacji.
- **Poprawka**: Przepisać 2.6 i krok 6 strategii: z poprawnym `.env` tymczasowo zepsuć
  zapytanie (np. `.from("characters")` → `.from("characters_x")` w
  `src/lib/character-pool-repo.ts:90`), sprawdzić kartę błędu bez 500 i `console.error`
  w konsoli serwera, przywrócić plik. W umowie strony dopisać, że null-branch jest obroną
  w głąb i za middleware nie jest osiągalny.
- **Decyzja**: NAPRAWIONE — umowa strony (Faza 2 §2), kryterium ręczne Fazy 2, krok 6 strategii
  i pozycja 2.6 w Postępie przepisane na „zepsute zapytanie w repo" zamiast „brak `.env`"

### F2 — Stan „Team is full (6/6)" w oknie jest nieosiągalny

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: Faza 2 §3 (TeamComposer), Faza 3 §2 (MemberPickerDialog), Krytyczne
  szczegóły → Sekwencjonowanie stanu, kryterium 3.8
- **Szczegóły**: Jedyne wejście do okna to „Recruit" na pustym slocie, a udane „Add to team"
  zamyka okno. Przy 6/6 nie ma pustego slotu, więc okna nie da się otworzyć — plan przyznaje
  to w 3.8 („jeśli dostępne"). Prop `isFull`, komunikat „Team is full (6/6)", gałąź domyślnego
  wyboru „pierwsza w puli, gdy skład pełny" i kryterium 3.8 opisują interfejs, którego nie da
  się pokazać ani zweryfikować. Cytat z FR-014 („nazywać limit wprost") dotyczy limitu perków,
  nie członków — ten nazywa już licznik `N/6`.
- **Poprawka A ⭐ Zalecana**: Usunąć nieosiągalny stan — wyciąć `isFull`, komunikat i gałąź
  „inaczej pierwsza w puli" (przy otwartym oknie zawsze ≤5 członków z 12 postaci); 3.8
  przepisać na „Przy 6/6 licznik pokazuje 6/6 i nie ma żadnego Recruit".
  - Siła: Mniej kodu i propsów; limit dalej nazwany (licznik + brak slotu), `team-full`
    dalej ma dowód w `npm test`.
  - Kompromis: Recenzent nie zobaczy zdania „Team is full" — tylko `6/6`.
  - Pewność: WYSOKA — wynika wprost z przepływu opisanego w planie.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Stały przycisk „Recruit" w nagłówku obok licznika, wyłączony przy 6/6
  z podpisem „Team is full"; okno zawsze osiągalne.
  - Siła: Jawny komunikat o limicie; wejście niezależne od slotów.
  - Kompromis: Dwa wejścia do jednego okna; komunikat i tak trzeba pokazać przy przycisku,
    nie w oknie (disabled nie otwiera).
  - Pewność: ŚREDNIA — więcej UI dla tego samego dowodu.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: NAPRAWIONE za pomocą poprawki A — `isFull` i komunikat usunięte z umowy okna
  i spięcia z wyspą; domyślny wybór to zawsze „pierwsza spoza drużyny"; stan końcowy, Krytyczne
  szczegóły, kryterium 3.8, krok 3 strategii i Postęp przepisane na „6/6 + brak Recruit"

### F3 — `pickerOpen` w Fazie 2 bez konsumenta nie przejdzie lintu

- **Waga**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 §3 (TeamComposer) i kryterium 2.1
- **Szczegóły**: „Przycisk może być podpięty do stanu bez skutku widocznego" — jeśli
  `pickerOpen` nie jest czytane, `@typescript-eslint/no-unused-vars`
  (`eslint.config.js:25-34`, ignorowane tylko nazwy z prefiksem `_`) wywali 2.1.
- **Poprawka**: Wprowadzić `pickerOpen` dopiero w Fazie 3 §3; w Fazie 2 slot dostaje
  `onRecruit`, który jeszcze nic nie robi.
- **Decyzja**: NAPRAWIONE — Faza 2 §3 ogranicza stan do `composition` z jawnym zakazem
  `pickerOpen`; Faza 3 §3 wprowadza `pickerOpen` razem z oknem

### F4 — Umowa okna nie wymienia `DialogTitle`

- **Waga**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3 §2 (MemberPickerDialog)
- **Szczegóły**: Radix loguje `console.error` i psuje dostępność, gdy `DialogContent` nie
  zawiera `DialogTitle` (i ostrzega przy braku opisu). Umowa wymienia kolumny i przycisk, ale
  nie tytuł.
- **Poprawka**: Dopisać do umowy `DialogTitle` „Recruit a member" oraz `DialogDescription`
  albo `aria-describedby={undefined}` na `DialogContent`.
- **Decyzja**: NAPRAWIONE — umowa Fazy 3 §2 wymienia `DialogHeader` z `DialogTitle`
  i `DialogDescription` (lub `aria-describedby={undefined}`)

## Sortowanie

- Naprawiono: F1, F2 (poprawka A), F3, F4 (4)
- Pominięto: — · Zaakceptowano: — · Odrzucono: —
- **Werdykt po poprawkach**: DO POPRAWY → SOLIDNY
