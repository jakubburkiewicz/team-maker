<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Ikonowe akcje na liście drużyn i uporządkowane akcje w edytorze

- **Plan**: `context/changes/2026-09-06-team-action-buttons/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-07
- **Werdykt**: DO POPRAWY → **SOLIDNY** po sortowaniu
- **Ustalenia**: 1 krytyczne, 4 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt (przed) | Werdykt (po poprawkach) |
| --- | --- | --- |
| Zgodność ze stanem końcowym | OSTRZEŻENIE | ZALICZONY |
| Oszczędne wykonanie | OSTRZEŻENIE | OSTRZEŻENIE (F6 pominięte świadomie) |
| Dopasowanie architektoniczne | ZALICZONY | ZALICZONY |
| Martwe punkty | OSTRZEŻENIE | ZALICZONY |
| Kompletność planu | NIEZALICZONY | ZALICZONY |

## Ugruntowanie

12/12 ścieżek ✓, 5/5 nowych plików nie istnieje ✓, 9/9 strażników uruchomionych dosłownie
na commicie bazowym (1 rozjazd → F1), Progress↔Faza 3/3 ✓ (10/16/20 kryteriów ↔ pozycji),
jeden nagłówek `## Progress`, zero checkboksów poza nim, brief↔plan ✓.

Potwierdzone w kodzie: `buttonVariants` + warianty `ghost`/`destructive`/`cosmic` + `size: "icon"`
(`src/components/ui/button.tsx:13,18,20,26,51`); `Pencil`/`Rocket`/`Trash2` istnieją
w `lucide-react@1.14.0`; `teams` na `/` w pełni serializowalne (`savedAt` już stringiem,
`src/pages/index.astro:42`); `TeamComposition` bez pustych slotów, duplikaty `characterId` odcięte
przez `evaluateTeam` — porównanie zbiorowe jest wystarczające; `DeleteTeamDialog` ma dziś dokładnie
jednego konsumenta (`src/pages/teams/[id].astro:151`); `TeamComposer` ma dwóch, oba do obsłużenia
zamianą `teamId` na prop obiektowy.

## Ustalenia

### F1 — Strażnik 1.6 przepuszcza tytuł strony, który dalej kłamie

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1, kryterium automatyczne 1.6
- **Szczegóły**: Plan twierdził, że `grep -nE 'is saved'` zwraca dziś trafienia „w tytule
  i nagłówku". Uruchomione dosłownie: **jedno** trafienie, w `<h1>`
  (`src/pages/teams/[id]/embark.astro:62`). Tytuł strony brzmi `Team ${team.name} saved` (`:56`) —
  bez słowa „is", więc strażnik go nie widział. Umowa Fazy 1 punkt 5 wymienia tytuł strony wprost
  jako to, co ma się zmienić, więc jedyny strażnik tej umowy zapaliłby się na zielono z kartą
  przeglądarki nadal orzekającą o zdarzeniu zapisu. Klasa: `lessons.md` §„Kryteria grepowe kotwicz
  na składni, nie na słowach".
- **Poprawka A ⭐ Zalecana**: `! grep -nE '\bsaved\b' 'src/pages/teams/[id]/embark.astro'` + korekta
  fałszywego zdania o trafieniach na bazie + doprecyzowanie umowy §5 (nowa treść nie używa słowa
  „saved" w tytule, nagłówku ani akapicie).
  - Siła: jeden wzorzec wiąże oba miejsca; nowa treść i tak orzeka o stanie („on the books").
  - Kompromis: zakazuje też sformułowań legalnych typu „was saved on <data>".
  - Pewność: WYSOKA — oba trafienia sprawdzone, oba czerwienią się na bazie.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: zostaw `is saved`, dołóż drugi strażnik na literał tytułu.
  - Siła: pełna swoboda słownictwa.
  - Kompromis: dwa kruche strażniki literalne zamiast jednej kotwicy.
  - Pewność: ŚREDNIA — wzorzec pęka przy każdej zmianie kształtu tytułu.
- **Decyzja**: NAPRAWIONE poprawką A (przesondowane: nowy strażnik zwraca `:56` i `:62` na bazie)

### F2 — Nieudane usunięcie z listy odsyła na 404 bez wyjaśnienia

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 (nowe wejście w istniejącą trasę); „Czego NIE robimy"
- **Szczegóły**: Faza 3 dokłada **drugie wejście** do `POST /api/teams/[id]/delete`, ale plan nie
  analizował jego ścieżki awarii. Trasa buduje odesłanie jako `/teams/${id}?error=…`
  (`src/pages/api/teams/[id]/delete.ts:49`) — cel zaprojektowany pod jedyne dotychczasowe wejście.
  Z listy na `/` nieudane usunięcie wyrzuca gracza na stronę drużyny, a przy `null` z repo
  na `TeamNotFound`, który komunikatu z `?error=` nie pokazuje (docstring `delete.ts:33-35`) —
  goły 404 zamiast informacji. Żadne z 19 kryteriów Fazy 3 nie dotykało ścieżki awarii.
- **Poprawka A ⭐ Zalecana**: nazwij jako przyjęte ryzyko w „Czego NIE robimy" i dopisz ręczne
  kryterium 3.20.
  - Siła: zero zmian w trasie zapisu; granica zakresu zostaje, martwy punkt przestaje być martwy.
  - Kompromis: zachowanie dokumentujemy, nie leczymy.
  - Pewność: WYSOKA — ścieżka odczytana wprost z `delete.ts:49,65-71`.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: `reject()` odsyła na `/?error=…`, `index.astro` dostaje gałąź komunikatu.
  - Siła: awaria kończy się tam, skąd gracz przyszedł.
  - Kompromis: łamie „Nie dotykamy tras zapisu"; psuje wejście z `/teams/[id]`, więc wymaga
    rozróżnienia wejść, czyli parametru, którego granica zabrania.
  - Pewność: ŚREDNIA — koszt rozróżnienia wejść niezbadany.
- **Decyzja**: NAPRAWIONE poprawką A (ryzyko nazwane + Progress 3.20)

### F3 — Neutralna treść ekranu wyruszenia osłabia FR-019 na ścieżce głównej

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: Faza 1 punkt 5; kryterium ręczne 1.8
- **Szczegóły**: Umowa nakładała na jeden tekst dwa przeciwstawne wymagania — „potwierdzić trwałość
  zapisu (FR-019)" i „nie orzekać o zdarzeniu, które mogło nie zajść w tym żądaniu" — i rozstrzygała
  je zdaniem „nazwa czytana z bazy jest dowodem trwałości". To argument retoryczny, nie sprawdzalny.
  FR-019 ma priorytet „musi być", a persona główna PRD (recenzent) idzie dokładnie ścieżką
  `/teams/new` → zapis → ten ekran. Kryterium 1.8 („nadal czytelnie potwierdza") było subiektywne.
- **Poprawka A ⭐ Zalecana**: jedna neutralna treść, ale 1.8 przepisane na sprawdzalne — ekran
  zawiera zdanie orzekające o **stanie**, nie o **czynności gracza**, i nazywa drużynę nazwą-hash
  odczytaną z bazy.
  - Siła: zero zmian w trasach zapisu; kryterium daje się odhaczyć bez sporu o odczucia.
  - Kompromis: ścieżka po zapisie traci jednoznaczność „właśnie się udało".
  - Pewność: WYSOKA — dzisiejszy akapit `embark.astro:64-66` już jest orzeczeniem o stanie.
  - Martwy punkt: nie zbadano, czy baner „Roster saved." na `/teams/[id]` nie niesie już tego
    potwierdzenia lepiej.
- **Poprawka B**: trasy zapisu odsyłają na `/teams/<id>/embark?saved=1`, ekran rozgałęzia treść.
  - Siła: obie ścieżki dostają tekst w pełni prawdziwy.
  - Kompromis: łamie własną granicę planu; dotyka dwóch tras API poza zakresem.
  - Pewność: ŚREDNIA — technicznie tanie, ale przebija zakres.
  - Martwy punkt: `?saved=1` da się podrobić w adresie — treść znów kłamie.
- **Decyzja**: NAPRAWIONE poprawką A

### F4 — Strażniki 2.3/2.4 nie wiążą tego, że okno przestało trzymać `open`

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2, kryteria 2.3 i 2.4
- **Szczegóły**: Sedno Fazy 2 to „okno przestaje być właścicielem `open`" — bez tego Faza 3 nie
  postawi jednego okna nad N wierszami. Żaden ze strażników tego nie wiązał. `^\s*onOpenChange`
  trafia w linię interfejsu propów, więc przechodzi także wtedy, gdy komponent zachowa
  `useState(false)` i tylko dorzuci prop; przechodzi też, gdy prettier przełamie JSX `<AlertDialog>`
  na wiele linii. `! grep 'setOpen\(true\)'` pada przy zwykłej zmianie nazwy settera. Wiążący
  warunek — `const [open, setOpen] = useState(false)` (`DeleteTeamDialog.tsx:43`) — nie był przez
  nikogo pilnowany, a czerwieni się na bazie idealnie.
- **Poprawka**: zastąp 2.4 strażnikiem celującym we właściciela stanu:
  `! grep -nE 'const \[open, setOpen\] = useState' src/components/team/DeleteTeamDialog.tsx`;
  `submitting` zostaje nietknięte, 2.3 zostaje jako uzupełnienie.
- **Decyzja**: NAPRAWIONE (przesondowane: nowy strażnik zwraca `:43` na bazie)

### F5 — Kryteria 3.5/3.6 liczą atrybuty, nie akcje

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3, kryteria 3.5 i 3.6
- **Szczegóły**: `grep -c 'aria-label' … -ge 3` nie mówi, że **trzy przyciski akcji** mają nazwy
  dostępne — mówi, że w pliku są trzy wystąpienia łańcucha. Repo stawia `aria-label` także na `<ul>`
  (`MemberPickerDialog.tsx:63`) i na `<svg>` (`CompetencyRadar.tsx:30`), więc kombinacja
  „lista + dwa linki, zero na koszu" przechodzi. `title=` jest słabsze: dziś ten łańcuch występuje
  w repo wyłącznie jako prop layoutu (`AppLayout title=`). Oba są przy tym zielone-przez-nieistnienie
  na bazie, bo plik jest nowy.
- **Poprawka**: kryterium liczy odczyty z modułu
  (`(aria-label|title)={<coś>.ariaLabel}`, ≥ 6), a treść nazw dostępnych wiąże asercja
  w `src/lib/team-actions.test.ts` — nie licznik.
- **Decyzja**: NAPRAWIONE

### F6 — `team-actions.ts` wiąże mniej, niż plan obiecuje

- **Waga**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Oszczędne wykonanie
- **Lokalizacja**: Faza 1 punkty 1-2; „Podejście do implementacji"
- **Szczegóły**: Uzasadnieniem modułu jest „rozjazd między listą a edytorem czerwieni się
  w `npm test`". Faktyczna część wspólna obu konsumentów to jeden adres (`embark`): `edit` używa
  wyłącznie lista, `label` bez ikony — wyłącznie edytor, `ariaLabel` z nazwą drużyny — wyłącznie
  lista. To trzeci moduł rodziny `nav.ts`/`routes.ts`, ale bez ich wymuszającego powodu (tam
  ekstrakcja wynikała z zakazu `astro:*` w testach Vitest). Sama unia rozróżnialna („delete jako
  link niereprezentowalny") jest tania i dobra — obserwacja dotyczy obietnicy, nie modułu.
- **Poprawka**: zejdź z obietnicy w „Podejściu do implementacji" — uzasadnij moduł kształtem typu
  i kodowaniem adresu, a nie ochroną przed rozjazdem dwóch ekranów.
- **Decyzja**: POMINIĘTE (świadomie — obserwacja o niskim wpływie, moduł i tak zostaje)
