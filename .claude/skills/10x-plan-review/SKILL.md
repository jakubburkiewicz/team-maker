---
name: 10x-plan-review
description: >
  Review implementation plans for substance, feasibility, and architectural fitness.
  Use when user asks to review a plan, says "is this plan good", "check my plan",
  "review this plan", mentions plan review, or references a plan file and asks
  for feedback. Also trigger when user finishes /10x-plan and wants validation
  before starting /10x-implement.
---

# Przegląd planu

Wykryj problemy merytoryczne w planie implementacji, zanim zostanie napisana choćby jedna linia kodu. Wadliwy plan kosztuje godziny — wadliwy przegląd kosztuje minuty.

Tam, gdzie `/10x-impl-review` pyta „czy zbudowaliśmy to, co zaplanowaliśmy?”, to narzędzie pyta „czy ten plan faktycznie zadziała?”.

Dwa tryby:
- **Świeży przegląd**: analiza → ustalenia → interaktywne sortowanie
- **Wznowienie sortowania**: załaduj zapisany raport i przejdź do sortowania poszczególnych problemów

## Rozwiązanie wejściowe

1. Argument wskazuje na zapisany plik przeglądu (zawiera `<!-- PLAN-REVIEW-REPORT -->`) → **wznów sortowanie** (przejdź do kroku 6)
2. Argument to `<change-id>` i istnieje `context/changes/<change-id>/plan.md` → przejrzyj ten plan
3. Podano ścieżkę planu (np. `@context/changes/<change-id>/plan.md`) → użyj jej
4. Brak argumentu → wyświetl listę `context/changes/*/plan.md` (najnowsze według `change.md.updated`) za pomocą AskUserQuestion
5. Flaga `--quick` → tryb tylko dokumentu (pominięcie kroku 3)

Jeśli rozwiązana ścieżka planu zaczyna się od `context/archive/`, odmów zapisania przeglądu: wydrukuj "This change is archived. Reviews are not appended to archived plans." i ZATRZYMAJ.

## Krok 1: Ładowanie i skanowanie spójności wewnętrznej

W pełni przeczytaj plik planu. Przeczytaj również siostrzany plik `plan-brief.md` w tym samym folderze zmian, jeśli istnieje. Przeczytaj `context/foundation/lessons.md`, jeśli jest obecny, i użyj zaakceptowanych reguł jako priorytetów podczas skanowania pod kątem problemów merytorycznych / wykonalności / naruszeń kontraktu — ustalenie, które powtarza znaną, powtarzającą się regułę, powinno mieć większą, a nie mniejszą wagę. Wyodrębnij:
- **Pożądany stan końcowy** i **Kryteria sukcesu**
- **Analiza stanu bieżącego** — udokumentowane ograniczenia i pułapki
- **Granice zakresu** — „Czego NIE robimy”
- **Fazy** — ścieżki plików, zmiany, zależności
- **Decyzje** i **założenia** (jawne i niejawne)
- **Sekcja postępu** — kanoniczny blok `## Progress` na dole planu (patrz `references/progress-format.md`)

Przed jakąkolwiek weryfikacją kodu, sprawdź plan pod kątem jego wewnętrznej spójności. Te trzy skany często wychwytują najcenniejsze problemy — problemy, które autor planu odkrył, ale których nie doprowadził do końca:

- **Sprzeczność**: czy analiza stanu bieżącego dokumentuje ograniczenie, które implementacja ignoruje? (np. „npm nie uruchamia preuninstall dla zależności”, a fazy na tym polegają) Czy elementy z „Czego NIE robimy” pojawiają się ponownie w fazach? Czy faza zakłada zachowanie, które gdzie indziej jest uznane za wadliwe?
- **Luka w obietnicy**: każda zdolność obiecana w Pożądanym Stanie Końcowym / Kryteriach Sukcesu / Notatkach Migracyjnych powinna mieć wspierającą fazę. Jeśli kryteria sukcesu mówią „ograniczenie szybkości działa”, ale żadna faza tego nie buduje, implementator napotyka lukę w trakcie budowy.
- **Naruszenia kontraktu** (gdy plan definiuje lub używa punktów końcowych API): śledź przepływ danych między punktami końcowymi — jeśli krok B potrzebuje tokena/ID z kroku A, czy odpowiedź A go zawiera? Oznacz nierozwiązane decyzje projektowe, które implementator musiałby zgadywać (który punkt końcowy, która metoda uwierzytelniania, które przechowywanie dla stanu ograniczenia szybkości).
- **Dotknięte powierzchnie kontraktu**: jeśli `docs/reference/contract-surfaces.md` istnieje w projekcie, przeczytaj go i wyodrębnij listę nagłówków H2 jako nazwy powierzchni. Uruchom `grep -F` na tekście planu z jednym `-e <surface name>` dla każdego nagłówka. Dla każdego trafienia, przeczytaj odpowiednią sekcję H2 `contract-surfaces.md` i zweryfikuj (a) czy plan dokładnie raportuje aktualny kształt powierzchni, oraz (b) czy jakakolwiek zmiana nazwy lub schematu jest oznaczona jako łamiąca z historią migracji dla konsumentów niższego poziomu. Jeśli plik nie istnieje, pomiń to sprawdzenie cicho — jest to konwencja opt-in, samoczynnie uruchamiana przy pierwszym użyciu przez `/10x-contract` lub gałąź sortowania `/10x-impl-review`. Lista grep pochodząca z H2 oznacza: gdy konsument dodaje nową powierzchnię do swojego pliku, następny przegląd planu automatycznie ją wykrywa — nie jest potrzebna edycja SKILL.md.
- **Spójność Postęp↔Faza** (kontrakt mechaniczny — patrz `references/progress-format.md`):
  - Dokładnie jeden nagłówek `## Progress` na dole plan.md.
  - Każda `## Phase N: <name>` w treści planu ma pasującą `### Phase N: <name>` w Progress.
  - Każdy punkt kryteriów sukcesu (pod `#### Automated Verification:` / `#### Manual Verification:`) w bloku Fazy ma pasujący `- [ ] N.M <title>` (lub `- [x]`) w odpowiedniej podsekcji Progress.
  - Bloki Fazy zawierają tylko zwykłe punkty `- ` — bez `- [ ]` lub `- [x]` poza sekcją Progress.
  Traktuj każdy z nich jako KRYTYCZNE ustalenie w ramach Kompletności Planu — `/10x-implement` nie będzie w stanie przetworzyć źle sformułowanej sekcji Progress.

## Krok 2: Ugruntowanie

Szybko, bez podagentów:
- **Ścieżki**: `ls -l` na ≥5 ścieżkach plików, które plan rzekomo modyfikuje. Nieistniejące ścieżki są krytyczne.
- **Symbole**: grep dla konkretnych funkcji/kluczy konfiguracyjnych, do których odwołuje się plan.
- **Spójność brief↔plan**: czy fazy, decyzje, zakres pasują?

Raportuj w linii: `Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓`. Eskaluj do ustalenia tylko w przypadku niepowodzenia.

## Krok 3: Weryfikacja bazy kodu (tylko tryb głęboki)

Pomiń, jeśli `--quick`.

Z kroków 1–2 zidentyfikuj **3–5 najbardziej ryzykownych twierdzeń** w planie — rzeczy, które, jeśli są błędne, wymuszają znaczną przeróbkę. Uruchom **jednego** podagenta (`subagent_type: "general-purpose"`) z trzema połączonymi zadaniami:

1. **Zweryfikuj najbardziej ryzykowne twierdzenia** w stosunku do rzeczywistego kodu. Dla każdego: co pokazuje kod, czy potwierdza, czy zaprzecza planowi, z dowodami plik:linia.
2. **Skanowanie promienia rażenia**: dla funkcji, stałych lub punktów końcowych, które plan modyfikuje, przeszukaj bazę kodu pod kątem innych wywołań/importerów niewymienionych w planie. Są to pliki, o których plan nie wie, że na nie wpływa.
3. **Sprawdzenie wzorca** (tylko jeśli plan wprowadza nowe wzorce): czy istniejące pliki w dotkniętych obszarach już to rozwiązują? Proliferacja wzorców jest częstym odkryciem.

Daj podagentowi ukierunkowane pytania z odpowiednimi ścieżkami plików — nie wyrzucaj całego planu. Skoncentrowane zapytanie znajduje więcej niż szerokie przeszukiwanie, ponieważ agent wie, czego szukać.

## Krok 4: Analiza merytoryczna

Przeanalizuj plan pod kątem pięciu wymiarów. Twórz ustalenia tylko dla rzeczywistych problemów — nie dodawaj „nie znaleziono problemów”.

### Zgodność ze stanem końcowym
Czy przechodząc fazy sekwencyjnie, system osiąga określony stan końcowy? Czy wszystkie kryteria sukcesu mogłyby zostać spełnione, podczas gdy cel pozostaje nieosiągnięty? Czy istnieje jakaś luka „ostatniej mili”, gdzie plan wykonuje 90% i zatrzymuje się?

### Oszczędna realizacja
Dla każdej fazy: „gdybym to usunął, czy stan końcowy nadal byłby osiągalny?” Zwróć uwagę na przedwczesną abstrakcję, dodatki „skoro już tu jesteśmy”, framework-gdzie-funkcja-by-wystarczyła, sprzeczności zakresu (elementy „nie robimy” pojawiające się w fazach).

### Dopasowanie architektoniczne
Czy to pasuje do istniejącego systemu? Nowe wzorce tam, gdzie istniejące by działały (proliferacja wzorców). Czyste granice modułów i prawidłowy kierunek zależności. Zmiany o dużym promieniu rażenia — fazy dotykające wielu plików w różnych modułach, zmiany w współdzielonych narzędziach. Niejasne „refaktoryzuj w razie potrzeby” lub „zaktualizuj odpowiednio”, które będą się rozprzestrzeniać.

### Martwe punkty
Czego plan nie wziął pod uwagę? Ścieżki błędów (opisana tylko ścieżka sukcesu?), historia wycofywania (faza 3 zawodzi — czy możemy cofnąć?), wpływ zasobów/kosztów (wywołania API, praca obliczeniowa — ile to kosztuje przy oczekiwanym użyciu?), zmiany wartości domyślnych (wartość domyślna, która potraja koszt lub czas, powinna być wskazana), luki w testowaniu, granice bezpieczeństwa.

### Kompletność planu
Czy dokument jest wykonalny? Czy ścieżki plików są specyficzne (nie „gdzieś w src/")? Czy zmiany są na poziomie funkcji/metody? Czy kryteria sukcesu zawierają uruchamialne polecenia? Sekcje TBD, TODO lub sekcje zastępcze?

## Krok 5: Kompilacja ustaleń

Każde ustalenie zawiera:

- **ID**: F1, F2, F3…
- **Waga**: KRYTYCZNE / OSTRZEŻENIE / OBSERWACJA (jak źle, jeśli zignorowane)
- **Wpływ**: NISKI / ŚREDNI / WYSOKI (ile uwagi wymaga decyzja)
- **Wymiar**: jeden z: Zgodność ze stanem końcowym / Oszczędna realizacja / Dopasowanie architektoniczne / Martwe punkty / Kompletność planu
- **Tytuł**: jedna linia
- **Lokalizacja**: sekcja planu lub faza
- **Szczegóły**: co jest nie tak z dowodami — twierdzenie planu kontra to, co jest faktycznie prawdą, lub czego brakuje
- **Opcje naprawy**: 1 lub 2 (patrz poniżej)

### Wpływ

Ortogonalny do wagi. KRYTYCZNE z NISKIM wpływem (oczywista poprawka) jest tanie do rozwiązania; OSTRZEŻENIE z WYSOKIM wpływem (niejasne kompromisy, szeroki zasięg) zasługuje na dokładne przemyślenie.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **NISKI** | Szybka decyzja. Poprawka jest oczywista i wąsko zakrojona. Bezpieczne do grupowania. |
| 🔎 **ŚREDNI** | Warto się zatrzymać. Prawdziwy kompromis lub nietrywialna edycja — pomyśl przed podjęciem decyzji. |
| 🔬 **WYSOKI** | Stawka architektoniczna. Szeroki promień rażenia, strategiczne implikacje lub niejasna najlepsza ścieżka. |

### Opcje naprawy

Domyślnie **jedna** poprawka. Przedstaw dwie tylko wtedy, gdy istnieje prawdziwy kompromis, który inteligentny recenzent chciałby rozważyć — nie każde ustalenie ma alternatywy warte tworzenia.

**Kiedy oferować dwie poprawki**: gdy podejście A i podejście B mają rzeczywistą zaletę, której brakuje drugiemu (np. „minimalna edycja, która łata objaw” kontra „refaktoryzacja, która usuwa klasę problemu”). Jeśli znajdziesz się na wymyślaniu słabej drugiej opcji, aby spełnić szablon, nie rób tego — przedstaw jedną poprawkę i przejdź dalej.

**Ustalenia o NISKIM wpływie**: pomiń dekompozycję — po prostu `Fix: [jedna linia]`. Hałas nie jest pomocny, gdy odpowiedź jest oczywista.

**Ustalenia o ŚREDNIM/WYSOKIM wpływie**: każda opcja otrzymuje:
```
[1-zdaniowe podejście] · Siła: [zaleta, najlepiej oparta na dowodach z planu/bazy kodu] · Kompromis: [koszt lub ryzyko] · Pewność: WYSOKA|ŚREDNIA|NISKA — [1-liniowe dlaczego] · Martwy punkt: [czego nie zweryfikowaliśmy, lub "Brak znaczących"]
```

Oferując dwie opcje, oznacz dokładnie jedną `⭐ Recommended`.

### Werdykty wymiarów i ogólny werdykt

Każdy wymiar: **ZALICZONY** / **OSTRZEŻENIE** / **NIEZALICZONY**.

- **SOLIDNY** — bezpieczny do wdrożenia. Wszystkie ZALICZONE lub ZALICZONE z drobnymi ostrzeżeniami.
- **DO POPRAWY** — wymaga ukierunkowanych poprawek. Wiele ostrzeżeń lub 1 niekrytyczny NIEZALICZONY.
- **DO PRZEMYŚLENIA** — fundamentalne problemy. Wiele NIEZALICZONYCH lub błędne podejście.

Posortuj ustalenia według wagi: KRYTYCZNE → OSTRZEŻENIE → OBSERWACJA. Ogranicz do 10 — skonsoliduj powiązane ustalenia, jeśli masz ich więcej.

## Krok 6: Przedstaw raport i zaoferuj zapisanie

Zwykły tekst, rysowanie ramek. Ustalenia pogrupowane według wagi; pomiń puste grupy. Wymiary ZALICZONE pojawiają się tylko w tabeli werdyktów, nigdy jako ustalenia.

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: [Plan Title]
  Mode: Deep / Quick  |  Date: YYYY-MM-DD
  Findings: [N critical] [N warnings] [N observations]
═══════════════════════════════════════════════════════════

  End-State Alignment    PASS    ✅
  Lean Execution         WARNING ⚠️   (1 finding)
  Architectural Fitness  PASS    ✅
  Blind Spots            FAIL    ❌   (1 finding)
  Plan Completeness      WARNING ⚠️   (1 finding)

  Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓
  ► Overall: REVISE

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — No rollback for 50M-row backfill
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Blind Spots
    Location:  Phase 3 — Database Changes

    Detail:
    Plan adds a NOT NULL column to users (50M rows) but no phase
    covers rollback if the backfill fails mid-way. Partial backfill
    leaves the table in an inconsistent state.

    Fix A ⭐ Recommended: Make column nullable + separate restartable backfill
      Strength:   Restartable; partial progress isn't destructive; matches
                  the pattern used for users.email_verified_at last quarter.
      Tradeoff:   Two deploys (add nullable → backfill → enforce NOT NULL).
      Confidence: HIGH — this exact approach shipped cleanly 3 months ago.
      Blind spot: Enforce step still needs its own rollback note.

    Fix B: Add explicit rollback phase with full table snapshot
      Strength:   Single deploy; rollback is atomic.
      Tradeoff:   50M-row snapshot is expensive in disk and lock time.
      Confidence: MEDIUM — haven't measured snapshot cost on a table this size.
      Blind spot: Replication lag during snapshot is unverified.

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — Provider pattern for 2 config sources
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔎 MEDIUM — real tradeoff; pause to reason through it
    Dimension: Lean Execution
    Location:  Phase 1 — Config Refactor

    Detail:
    Plan builds a full provider-pattern config system for only two
    sources (env + file). A direct dict merge achieves the same end
    state with ~1/3 the code.

    Fix: Replace config provider abstraction with direct dict merge in
         load_config(). Introduce the provider pattern only when a third
         source appears.
      Strength:   Less code, fewer concepts to maintain.
      Tradeoff:   If a third source ships soon, we refactor twice.
      Confidence: HIGH — the existing codebase follows this "add abstraction
                  when needed" pattern everywhere else.
      Blind spot: Plans for additional config sources not surveyed.

  ···

  F3 — Vague "refactor utils as needed"
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW — quick decision; fix is obvious and narrowly scoped
    Dimension: Plan Completeness
    Location:  Phase 2

    Detail:
    "Refactor format_output as needed" — format_output is imported by
    12 files across 4 modules. Implementer has no guidance.

    Fix: Specify exact signature changes and list callers needing updates.

═══════════════════════════════════════════════════════════
```

### Zasady formatowania raportu

- **Linia tytułu ustalenia** zawiera tylko ID i krótki tytuł — nic więcej. Wszystko inne znajduje się poniżej jako oznaczone pola, dzięki czemu każdy wiersz jest krótki i łatwy do skanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ CRITICAL`, a nie tylko `❌`. Dzięki temu raport jest czytelny podczas szybkiego przeglądania i nie zmusza użytkownika do zapamiętywania znaczenia każdej ikony.
- **Wpływ zawsze zawiera swoje jednowierszowe znaczenie** (skopiuj z tabeli Wpływ — „stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji” / „prawdziwy kompromis; zatrzymaj się, aby to przemyśleć” / „szybka decyzja; poprawka jest oczywista i wąsko zakrojona”). Dzięki temu NISKI/ŚREDNI/WYSOKI jest zrozumiały w miejscu użycia, zamiast polegać na tym, że użytkownik pamięta tabelę.
- Waga, Wpływ, Wymiar, Lokalizacja znajdują się każda w osobnej linii z wyrównanymi etykietami. Szczegóły zaczynają się w osobnej linii pod etykietą `Detail:`, dzięki czemu mogą naturalnie zawijać się.

Następnie zapytaj:

```
question: "Plan review complete. How would you like to proceed?"
header: "Plan Review — [N] findings"
options:
  - label: "Triage findings"
    description: "Walk through each finding and decide."
  - label: "Save report & triage later"
    description: "Save the full report. Resume with /10x-plan-review <report-path>."
  - label: "Save report only"
    description: "Save and finish — I'll handle the findings myself."
multiSelect: false
```

### Zapisywanie raportu

Zapisz do `context/changes/<change-id>/reviews/plan-review.md` (jeden przegląd planu na folder zmiany; ponowne uruchomienie nadpisuje). Zaktualizuj `change.md`: `status: plan_reviewed`, `updated: <today>`.

```markdown
<!-- PLAN-REVIEW-REPORT -->
# Plan Review: [Plan Title]

- **Plan**: [plan file path]
- **Mode**: Deep / Quick
- **Date**: YYYY-MM-DD
- **Verdict**: [SOUND/REVISE/RETHINK]
- **Findings**: [N critical] [N warnings] [N observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS/WARNING/FAIL |
| Lean Execution | PASS/WARNING/FAIL |
| Architectural Fitness | PASS/WARNING/FAIL |
| Blind Spots | PASS/WARNING/FAIL |
| Plan Completeness | PASS/WARNING/FAIL |

## Grounding
[grounding line]

## Findings

### F1 — No rollback for 50M-row backfill

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Database Changes
- **Detail**: Plan adds a NOT NULL column to users (50M rows) but no phase covers rollback if the backfill fails mid-way.
- **Fix A ⭐ Recommended**: Make column nullable + separate restartable backfill
  - Strength: Restartable; partial progress isn't destructive.
  - Tradeoff: Two deploys.
  - Confidence: HIGH — this approach shipped cleanly last quarter.
  - Blind spot: Enforce step still needs its own rollback note.
- **Fix B**: Add explicit rollback phase with full table snapshot
  - Strength: Single deploy; rollback is atomic.
  - Tradeoff: 50M-row snapshot is expensive in disk and lock time.
  - Confidence: MEDIUM — snapshot cost unverified at this size.
  - Blind spot: Replication lag during snapshot is unverified.
- **Decision**: PENDING

### F3 — Vague "refactor utils as needed"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2
- **Detail**: "Refactor format_output as needed" — imported by 12 files across 4 modules.
- **Fix**: Specify exact signature changes and list callers needing updates.
- **Decision**: PENDING
```

Znacznik `<!-- PLAN-REVIEW-REPORT -->` i pola `Decision: PENDING` umożliwiają tryb wznowienia.

„Zapisz i posortuj później” → zapisz, wydrukuj ścieżkę, przypomnij o uruchomieniu `/10x-plan-review <saved-report-path>`.
„Sortuj” → przejdź do kroku 7.

## Krok 7: Interaktywne sortowanie

### Tryb wznowienia

Jeśli wprowadzono za pomocą zapisanego pliku: przeczytaj go, przeanalizuj nagłówki `### F`, filtruj do `Decision: PENDING`. Jeśli brak, powiedz „Wszystkie ustalenia posortowane” i zatrzymaj się.

### Pętla sortowania

Przejdź przez ustalenia w kolejności ważności (KRYTYCZNE → OSTRZEŻENIE → OBSERWACJA). Dla każdego:

**Z 2 opcjami naprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix A block]\n\n[Fix B block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Apply Fix A ⭐"
    description: "[Fix A one-liner]"
  - label: "Apply Fix B"
    description: "[Fix B one-liner]"
  - label: "Fix differently"
    description: "Different approach — let's discuss."
  - label: "Skip"
    description: "Not worth addressing now."
  - label: "Accept risk"
    description: "Understood — I'll handle during implementation."
  - label: "Disagree"
    description: "Not actually an issue — dismiss."
multiSelect: false
```

**Z 1 opcją naprawy:** te same opcje, ale zastąp „Zastosuj poprawkę A/B” pojedynczym „Popraw w planie”.

**Obsługa odpowiedzi:**
- **Zastosuj poprawkę A/B / Popraw w planie**: pokaż dokładną edycję planu (przed/po). Krótkie potwierdzenie, a następnie zastosuj. Oznacz NAPRAWIONE (zapisz, która poprawka, np. „Naprawiono za pomocą poprawki A”).
- **Popraw inaczej**: zapytaj o preferowane podejście, zastosuj, oznacz NAPRAWIONE.
- **Pomiń** → POMINIĘTO. **Akceptuj ryzyko** → ZAAKCEPTOWANO. **Nie zgadzam się** → ODRZUCONO. Idź dalej, nie kłóć się.

Po każdej decyzji, jeśli pracujesz z zapisanego pliku, zaktualizuj jego pole `Decision:`.

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1 (Fix A), F3   (2)
  Skipped:   F4               (1)
  Accepted:  F2               (1)
  Dismissed: F5               (1)

  ► Verdict after fixes: [updated if fixes changed it, e.g. REVISE → SOUND]
═══════════════════════════════════════════════════════════
```

## Uwagi

- To jest umiejętność **przeglądu**. Analizuj i raportuj — nie przepisuj planu, chyba że zostanie to poproszone podczas sortowania.
- Bądź konkretny. „Faza 3 wprowadza drugi system zdarzeń obok istniejącego EventBus w `src/core/events.ts`” — a nie „architektura może mieć problemy”.
- Rozróżnij „nie zadziała” (NIEZALICZONY) od „może być lepiej” (OSTRZEŻENIE).
- Jeśli plan jest naprawdę dobry, powiedz to krótko i zakończ. Nie twórz ustaleń.
- Wpływ dotyczy **wysiłku decyzyjnego**, a nie **wagi**. NISKI wpływ na KRYTYCZNE ustalenie oznacza, że poprawka jest oczywista; WYSOKI wpływ na OSTRZEŻENIE oznacza, że kompromis jest realny.
- Dwie opcje naprawy tylko wtedy, gdy istnieje prawdziwy kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas sortowania utrzymuj tempo. Użytkownik już przeczytał raport — przedstaw ustalenie, podejmij decyzję, przejdź dalej.
- Podczas stosowania poprawki do planu, dokonuj minimalnych, ukierunkowanych edycji. Nie restrukturyzuj całego planu dla jednego ustalenia.