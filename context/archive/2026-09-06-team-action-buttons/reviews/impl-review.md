<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Ikonowe akcje na liście drużyn i uporządkowane akcje w edytorze

- **Plan**: `context/changes/2026-09-06-team-action-buttons/plan.md`
- **Zakres**: Fazy 1-3 z 3 (pełny plan) — commity 82cc70f, 2ccfa43, 76df061; baza 21b9d96
- **Data**: 2026-09-07
- **Werdykt**: WYMAGA UWAGI → triaż zamknięty 2026-09-07 (5 naprawionych, 1 reguła, 1 pominięte, 1 przyjęte jako ryzyko)
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

## Bramki jakości

| Komenda | Wynik |
|---|---|
| `npx astro sync` | PASS |
| `npm run lint` | PASS (1 ostrzeżenie w `AppHeader.astro:49` — plik poza zakresem) |
| `npm test` | PASS — 17 plików, 193 testy |

Wszystkie 22 kryteria automatyczne planu uruchomione dosłownie: przechodzą. Czerwień na commicie
bazowym potwierdzona dla 2.3, 2.4, 2.6, 3.3, 3.4. Zgodność 12/12 zaplanowanych zmian (MATCH).
Granice zakresu nienaruszone — `git diff --stat 21b9d96..HEAD` po `src/pages/teams/new.astro`,
`src/lib/nav.ts`, `src/lib/domain`, `src/lib/team-repo.ts`, `supabase`, `src/pages/api` zwraca pustkę.

Trzy krytyczne punkty planu spełnione dosłownie i z zapasem: przycisk gałęzi awarii stoi
strukturalnie w `else` (`[id].astro:135-170`), porównanie składu jest zbiorowe na obu poziomach
z jawną obroną przed duplikatami (`composition-changes.ts:27-33,52-67`), a `delete` nie ma `href`
na poziomie typu (`team-actions.ts:29-41`).

## Ustalenia

### F1 — Stan `submitting` nie ma ścieżki powrotu i blokuje usuwanie **wszystkich** drużyn na `/`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: `src/components/team/DeleteTeamDialog.tsx:57,74,83-86`
- **Szczegóły**: `const [submitting, setSubmitting] = useState(false)` jest ustawiany na `true`
  w `onClick` przycisku i **nigdy** nie wraca do `false` — nie ma `onEscapeKeyDown`, nie ma resetu
  w `onOpenChange`, nie ma `key` wymuszającego remount. Na commicie bazowym to nie bolało: okno było
  jedno na wyzwalacz i tylko na `/teams/[id]`, a nieudany POST i tak kończył się pełną nawigacją.
  Ta zmiana stawia **jedną** instancję nad N wierszami (`TeamList.tsx:101-109`), a komponent
  zewnętrzny nigdy się nie odmontowuje — odmontowuje się tylko treść (`target !== null &&`).
  Zamrożony `submitting` z wiersza A unieruchamia więc usuwanie **każdej** drużyny na stronie:
  przycisk potwierdzenia pokazuje „Deleting…" i jest `disabled`, a `AlertDialogCancel` też jest
  `disabled` (`:74`) — okno staje się ślepą uliczką, z której wychodzi się wyłącznie Escapem lub
  przeładowaniem. Radix `alert-dialog` nie blokuje Escape (w `dist/index.mjs` są tylko
  `onPointerDownOutside` i `onInteractOutside`), więc Escape w trakcie wysyłki zatrzymuje POST
  **i** zamyka okno, zostawiając stan zamrożony. Druga droga: powrót przyciskiem Wstecz z bfcache.
  Docstring `:35-38` uzasadnia trzymanie `submitting` w środku, ale nie rozważa zamknięcia w trakcie
  wysyłki — założenie „jedno okno na wyzwalacz" przestało obowiązywać w Fazie 3.
- **Poprawka A ⭐ Zalecane**: Zresetować stan przy zmianie celu i domknąć Escape — `key={target?.id}`
  na treści okna (albo czyszczenie `submitting` w `onOpenChange` przy `false`) plus
  `onEscapeKeyDown={(e) => { if (submitting) e.preventDefault(); }}` na `AlertDialogContent`.
  Przy okazji przenieść `setSubmitting` z `onClick` przycisku na `<form onSubmit>`, zgodnie ze
  wzorcem `CompositionGate.tsx:51-53`, który docstring sam przywołuje jako źródło.
  - Siła: Usuwa obie drogi do zamrożenia naraz i wyrównuje komponent z bramką zapisu, do której
    docstring się odwołuje. `key` na celu jest tu naturalny — cel i tak jest tożsamością okna.
  - Kompromis: Trzy drobne edycje w jednym pliku; `onEscapeKeyDown` to nowy prop Radix w tym repo.
  - Pewność: WYSOKA — brak resetu potwierdzony grepem (`setSubmitting` występuje raz), brak
    odmontowania potwierdzony strukturą `TeamList.tsx:101-109`.
  - Martwy punkt: Nie sprawdzono zachowania bfcache w realnej przeglądarce — rozumowanie opiera się
    na braku `ClientRouter` w repo.
- **Poprawka B**: Zostawić kod, zawęzić docstring do tego, co faktycznie obowiązuje, i przyjąć
  zamrożenie jako ryzyko — wychodzi się z niego przeładowaniem, a persona główna PRD usuwa drużynę raz.
  - Siła: Zero zmian w kodzie wysyłki, więc zero ryzyka regresji w ścieżce, która dziś działa.
  - Kompromis: Zostawia stan, w którym lista przestaje przyjmować usuwanie bez widocznego powodu —
    dokładnie ta klasa cichej awarii, przed którą broni się „Krytyczne szczegóły implementacji" planu.
  - Pewność: ŚREDNIA — zależy od tego, jak często Escape trafia w okno w trakcie wysyłki.
  - Martwy punkt: Nie zmierzono realnej częstości; przy szybkim POST okno wysyłki jest krótkie.
- **Decyzja**: FIXED — poprawka A, **skorygowana przy zastosowaniu**. Dwa z trzech elementów
  poprawki A okazały się błędne: (1) `key={target.id}` na `AlertDialogContent` nie resetuje
  `submitting`, bo stan mieszka w komponencie **zewnętrznym**, a w `TeamActions` /
  `DeleteTeamButton` `target.id` i tak się nie zmienia; (2) `onEscapeKeyDown` blokujący Escape
  tworzy pułapkę bez wyjścia, gdy `submitting` jest nieaktualny (powrót z bfcache — żaden POST
  nie leci, a `Cancel` jest zgaszony). Zastosowano zamiast tego: reset `submitting` przy
  zamknięciu okna w opakowanym `onOpenChange` (pokrywa też ponowne otwarcie na tym samym celu)
  oraz przeniesienie `setSubmitting` z `onClick` przycisku na `<form onSubmit>` zgodnie
  z `CompositionGate.tsx:51-53`. Docstring odnotowuje powód i **świadomą** rezygnację z blokady
  Escape. `npm run lint` czysty, `npm test` 193/193.

### F2 — Weryfikacja bazowa strażnika 1.6 jest niewykonalna: `git grep -E` nie zna `\b`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-06-team-action-buttons/plan.md` §Faza 1 kryterium 1.6
- **Szczegóły**: Plan nakazuje uruchomić strażnik na commicie bazowym i stwierdza wprost:
  „`git grep -nE '\bsaved\b' HEAD -- 'src/pages/teams/[id]/embark.astro'` zwraca dziś **dwa**
  trafienia: nagłówek `:62` i tytuł strony `:56`". Uruchomiona dosłownie komenda zwraca **zero**
  trafień — `\b` jest rozszerzeniem GNU/BSD `grep`, a nie POSIX ERE, którego używa `git grep -E`.
  Sonda: `git grep -nE 'saved' 21b9d96 -- …` → 2 trafienia, `git grep -nP '\bsaved\b' …` → 2
  trafienia, `git grep -nE '\bsaved\b' …` → 0. Ten sam wzorzec ma więc dwa różne znaczenia
  w dwóch narzędziach użytych w tym samym kryterium. Intencja jest spełniona — `git show 21b9d96:… |
  grep -nE '\bsaved\b'` potwierdza dwa trafienia na bazie i zero na HEAD, a strażnik po stronie HEAD
  (zwykły `grep`) działa poprawnie. Ale Progress 1.6 podpisano `[x]` z adnotacją „strażnik czerwony
  na bazie", której **nie dało się uzyskać** podaną komendą. To czwarte z rzędu wystąpienie klasy
  „strażnik grepowy nie wiąże" po trzech lekcjach w `context/foundation/lessons.md`; żadna z nich nie
  obejmuje rozjazdu `grep` vs `git grep`.
- **Poprawka**: W planie zamienić komendę weryfikacji bazowej na `git show <base>:'<ścieżka>' | grep -nE '\bsaved\b'`
  (albo `git grep -nP`), żeby to samo narzędzie liczyło po obu stronach.
- **Decyzja**: FIXED — `plan.md:249` przepisane na `git show HEAD:'…' | grep -nE '\bsaved\b'`,
  plus dopisek wyjaśniający, dlaczego weryfikacja bazowa nie może iść przez `git grep -E`.
  Poprawiona komenda uruchomiona dosłownie: dwa trafienia na `21b9d96` (czerwień na bazie),
  zero na HEAD — dokładnie to, co plan deklarował.

### F3 — Pięć strażników przechodzi warianty rozbrajające; licznik 3.5 nie wiąże trzech różnych akcji

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `plan.md` §Faza 2 kryteria 2.3, 2.5; §Faza 3 kryteria 3.3, 3.4, 3.5, 3.7
- **Szczegóły**: Kod jest poprawny (12/12 MATCH), ale strażniki, które mają go wiązać, przepuszczają
  rozbrojenie. Sondy na kopiach poza repozytorium:

  | Strażnik | Wariant rozbrajający | Wynik |
  |---|---|---|
  | 2.3 `^\s*onOpenChange` | prop zadeklarowany w interfejsie, **niepodpięty** do `AlertDialog` | zielony |
  | 2.4 `! grep 'const \[open, setOpen\] = useState'` | własny stan pod nazwą `isOpen` | zielony |
  | 2.5 / 3.7 `! grep '/teams/\$\{\|"/teams/'` | adres sklejany: `` `/teams/` + team.id `` | zielony |
  | 3.3 `grep 'client:[a-z]+'` | sam komentarz o `client:load`, zero wysp | zielony |
  | 3.4 `! grep 'teams/\$\{'` | `href={"/teams/" + team.id}` | zielony |
  | 3.5 licznik `≥ 6` | **jedna** akcja powtórzona 3×, atrybuty w osobnych liniach | 6 → zielony |

  Strażnik 3.5 zasługuje na osobną uwagę, bo plan poświęcił mu akapit obrony przed „gołym
  `grep -c 'aria-label' … -ge 3`": `grep -c` liczy **linie**, nie trafienia, więc próg 6 domyka się
  jedną akcją, której `aria-label` i `title` stoją w osobnych liniach — bez ani jednego Edit i bez
  Delete. Kryterium 3.6 słusznie przenosi ciężar na asercję w `team-actions.test.ts`, i to ona
  faktycznie wiąże treść; sam licznik nie wnosi nic ponad nią. Strażnik 3.3 jest dziś zielony
  częściowo z komentarza `index.astro:21` — trafia w prozę opisującą dokładnie to, czego ma pilnować
  (`lessons.md` §„Kryteria grepowe kotwicz na składni, nie na słowach").
- **Poprawka**: Przy najbliższym planie dotykającym tych plików przepisać strażniki na warianty
  z tabeli — kotwica na podpięciu (`onOpenChange={`), na `useState` bez nazwy zmiennej, na segmencie
  `/teams/` niezależnym od formy cytowania, oraz strzyżenie komentarzy w 3.3. Licznik 3.5 skreślić na
  rzecz samego 3.6. Ustalenie nie wymaga zmian w kodzie tej zmiany.
- **Decyzja**: ACCEPTED-AS-RULE: „Strażnik musi mierzyć to, co deklaruje — narzędzie, jednostka
  zliczania i podpięcie" (`context/foundation/lessons.md`). Strażników w `plan.md` tej zmiany
  świadomie **nie** przepisano: zmiana jest zamknięta, a kod poprawny — reguła zadziała na
  kolejnych planach, gdzie ma jeszcze co związać.

### F4 — `CompositionGate` wstawia `teamId` surowo wbrew regule kodowania wprowadzonej tą zmianą

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/components/team/CompositionGate.tsx:50`
- **Szczegóły**: Ta zmiana konsekwentnie koduje identyfikator w adresach — `team-actions.ts:58`
  (`/teams/${encodeURIComponent(id)}`) i `DeleteTeamDialog.tsx:79` (utwardzone względem bazy, gdzie
  było surowe). Bramka zapisu, która od Fazy 2 dostaje `team?.id` z **tego samego** obiektu
  (`TeamComposer.tsx:153`), nadal robi `action={editing ? \`/api/teams/${teamId}\` : "/api/teams"}`.
  Praktycznie nieszkodliwe — `id` pochodzi z bazy, a `isTeamId` w repo pilnuje formatu — ale docstring
  `team-actions.ts:52-56` uzasadnia kodowanie zdaniem „moduł nie zakłada, że dostał UUID"
  i powołuje się na trasy API; `CompositionGate` łamie tę samą zasadę o jedno wywołanie dalej.
- **Poprawka**: Dopisać `encodeURIComponent(teamId)` w `CompositionGate.tsx:50`.
- **Decyzja**: FIXED — `CompositionGate.tsx:50` używa teraz `encodeURIComponent(teamId)`, zgodnie z regułą, którą ta zmiana wprowadziła w `team-actions.ts:58` i `DeleteTeamDialog.tsx:79`.

### F5 — Frontmatter `index.astro` zmieniony mimo umowy „bez zmian co do joty"

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `src/pages/index.astro:2,31`
- **Szczegóły**: Umowa Fazy 3 punkt 2 brzmi „Frontmatter zostaje bez zmian co do joty" i wylicza,
  co ma przetrwać. Cała wyliczona logika przetrwała (`listTeams`, `null` vs `[]`, `Intl.DateTimeFormat`
  przy odczycie, baner `?deleted=1`, gałąź `!supabase`), ale lokalny `interface TeamRow` został
  usunięty i zastąpiony importowanym `TeamListRow` z wyspy. Kształt typu jest identyczny, a jedno
  źródło prawdy o kształcie wiersza jest lepsze niż dwa — odchyłka jest korzystna, nie szkodliwa.
  Odnotowana, bo umowa była sformułowana absolutnie, a przegląd czyta umowy dosłownie.
- **Poprawka**: Żadna w kodzie — ewentualnie dopisek w planie, że umowa dotyczyła logiki odczytu,
  nie deklaracji typów.
- **Decyzja**: SKIPPED — odchyłka uznana za korzystną i zaakceptowana bez zmian w kodzie ani w planie. Jedno źródło prawdy o kształcie wiersza jest lepsze niż dwa.

### F6 — `listTeams` bez limitu, a wiersze trafiają do HTML dwa razy

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Wydajność)
- **Lokalizacja**: `src/lib/team-repo.ts:205`, `src/pages/index.astro:44`
- **Szczegóły**: `listTeams` nie ma `.limit()` ani `.range()`. Do tej zmiany lista była statycznym
  markupem SSR; teraz jest wyspą `client:load`, a Astro serializuje propsy wyspy do atrybutu na
  `<astro-island>` — każdy wiersz jest w odpowiedzi **dwa razy**: raz jako markup, raz jako JSON.
  Komentarze `index.astro:21-25` i `TeamList.tsx:36-39` powołują się na „FR-006 nie stawia limitu
  drużyn na konto" jako uzasadnienie **jednego** okna nad listą, ale sama lista pozostaje
  nieograniczona, więc argument nie domyka się do końca. Przy skali z PRD (persona = recenzent,
  kilka drużyn) to nie boli.
- **Poprawka**: Przyjąć jako świadome ryzyko albo dołożyć `.limit(100)` w `listTeams`.
- **Decyzja**: ACCEPTED — ryzyko przyjęte świadomie. Przy skali z PRD (persona = recenzent, kilka drużyn) brak limitu nie boli, a `.limit()` dotykałoby `src/lib/team-repo.ts`, którego plan tej zmiany wprost zakazał.

### F7 — Docstring `TeamActions` obiecuje ochronę pracy szerszą niż faktyczna

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Bezpieczeństwo danych)
- **Lokalizacja**: `src/components/team/TeamActions.tsx:29-31`
- **Szczegóły**: Docstring mówi: „przy niezapisanych zmianach odmawia, żeby nie wyprowadzić gracza
  z ekranu i nie zgubić jego pracy". Blokada obejmuje wyłącznie przycisk wyruszenia. Na tym samym
  ekranie `AppHeader` renderuje `NAV_ITEMS` („Your teams", „New team"), a `AppLayout` nie zakłada
  `beforeunload` — kliknięcie w menu, Wstecz albo zamknięcie karty gubi pracę tak samo, bez
  ostrzeżenia. Zdanie opisuje intencję szerszą niż mechanizm.
- **Poprawka**: Zawęzić docstring do tego, co faktycznie chroni (jeden przycisk, jedna ścieżka).
  Dokładanie `beforeunload` byłoby nowym zakresem — Non-Goals PRD nie obiecują ochrony pracy w toku.
- **Decyzja**: FIXED — docstring `TeamActions.tsx` zawężony do tego, co mechanizm faktycznie chroni (jedna droga wyjścia), z jawną notą, że nagłówek powłoki, Wstecz i zamknięcie karty gubią zmiany tak samo. `beforeunload` świadomie nie dodany — to nowy zakres.

### F8 — Wiersz listy stracił reakcję na hover

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `src/components/team/TeamList.tsx:51-54`
- **Szczegóły**: Umowa Fazy 3 punkt 1 mówi „listę kart o tym samym wyglądzie co dziś". Karta na
  bazie miała `transition-colors hover:border-purple-400/60 hover:bg-white/20` na opakowującym
  `<a>` (`index.astro:106` na 21b9d96); dziś `<li>` nie ma żadnego stanu hover. Utrata **stretched
  link** jest nieunikniona — plan sam jej zakazał — ale utrata sprzężenia zwrotnego hover na karcie
  już nie: `<li>` może nosić te same klasy bez bycia linkiem. Fokus jest zachowany (pierścień na
  nazwie i na ikonach), więc dostępność klawiaturowa nie ucierpiała.
- **Poprawka**: Przenieść `transition-colors hover:border-purple-400/60 hover:bg-white/20` na `<li>`.
- **Decyzja**: FIXED — `transition-colors hover:border-purple-400/60 hover:bg-white/20` przeniesione na `<li>` w `TeamList.tsx`. Karta znów reaguje na hover, nie będąc linkiem.
