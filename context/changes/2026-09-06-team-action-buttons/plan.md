# Plan implementacji: Ikonowe akcje na liście drużyn i uporządkowane akcje w edytorze

## Przegląd

Wiersz listy drużyn na `/` dostaje trzy akcje bez etykiet — Embark, Edit, Delete — wyrażone
ikonami (pkt 6 zgłoszenia). Strona edycji `/teams/[id]` dostaje brakujący przycisk „Embark on the
job" i odzyskuje kontekst dla „Delete team", który dziś wisi pod całą siatką (pkt 7).

Obie zmiany opierają się na jednym czystym module opisującym trzy akcje (adresy, etykiety, nazwy
dostępne) i na czystym porównaniu „czy widoczny skład różni się od zapisanego" — bo nowy przycisk
Embark w edytorze musi umieć odmówić, gdy gracz ma niezapisane zmiany.

## Analiza stanu obecnego

- **Wiersz listy jest jednym `<a>`** opakowującym całą kartę (`src/pages/index.astro:105-112`).
  Trzy przyciski nie mogą wejść do jego wnętrza — zagnieżdżony element interaktywny to niepoprawny
  HTML i zepsuta nawigacja klawiaturą. Wiersz wymaga przebudowy struktury.
- **`/` jest czystym SSR** — zero dyrektyw `client:*` w całym pliku. Akcja Delete wymaga okna
  potwierdzenia (FR-010, US-03), więc lista przestaje być stroną bez JavaScriptu.
- **`DeleteTeamDialog` jest dziś samowystarczalny**: sam trzyma stan `open`, sam renderuje swój
  wyzwalacz z etykietą „Delete team" i sam okno (`src/components/team/DeleteTeamDialog.tsx:52-64`).
  Nie da się z niego zbudować „jedno okno, N wyzwalaczy".
- **`Delete team` stoi poza kontekstem**: `src/pages/teams/[id].astro:151-155` renderuje go
  w `<div class="mt-4 flex flex-col">` pod całą siatką kompozytora, a sam przycisk ma `self-end`.
- **`CompositionGate` ma jeden przycisk o dwóch etykietach** — „Embark on the job" przy tworzeniu,
  „Save changes" przy edycji, rozstrzygane obecnością `teamId`
  (`src/components/team/CompositionGate.tsx:60-61`). Docstring komponentu wprost broni się przed
  rozdwojeniem bramki na dwie kopie warunku `!ready`.
- **Skład żyje wyłącznie w pamięci wyspy**: `useState(initialComposition)` bez `useEffect`
  (`src/components/team/TeamComposer.tsx:52`). Nic poza wyspą nie wie, czy gracz coś zmienił.
- **`/teams/[id]/embark` mówi „Team <nazwa> is saved"** (`src/pages/teams/[id]/embark.astro:60-66`)
  — treść zbudowana pod jedno wejście: tuż po udanym zapisie (FR-019).
- **`button.tsx` ma już `size: "icon"` (`size-9`)** i wariant `cosmic`; `lucide-react` jest
  w zależnościach, a `Rocket` i `Trash2` są już w użyciu.
- **Konwencja nazw dostępnych** istnieje: `aria-label` na przyciskach ikonowych
  (`src/components/team/RosterSlot.tsx:120`, `src/components/auth/PasswordToggle.tsx:14`).
- **Wzorzec czystego modułu pod testem** istnieje: `src/lib/nav.ts` + `src/lib/nav.test.ts` —
  reguła wyjęta z `.astro` właśnie po to, żeby dała się przetestować bez Astro i Supabase.
- `context/foundation/roadmap.md` **nie zawiera** pozycji o `Change ID`
  `2026-09-06-team-action-buttons` — to zmiana poza roadmapą, więc synchronizacja statusu jest
  no-opem.

## Pożądany stan końcowy

Na `/` każdy wiersz listy pokazuje nazwę-hash jako link do drużyny, datę zapisu i trzy ikonowe
przyciski bez tekstu: wyruszenie, edycja, usunięcie. Każda ikona ma nazwę dostępną zawierającą
nazwę drużyny oraz natywny dymek. Usunięcie prowadzi przez to samo okno potwierdzenia co dziś —
jedno okno na całą listę, niezależnie od liczby drużyn.

Na `/teams/[id]` kolumna boczna zawiera pod wykresem i licznikiem braków komplet akcji drużyny:
„Save changes" (bramka progu, bez zmian), „Embark on the job" i „Delete team". Embark jest
zablokowany, dopóki widoczny skład różni się od zapisanego, i mówi wprost dlaczego.

`/teams/[id]/embark` mówi prawdę o obu wejściach: potwierdza trwałość zapisu (FR-019) i nie twierdzi,
że gracz właśnie zapisał, gdy przyszedł z listy.

Weryfikacja: `npx astro sync && npm run lint && npm test && npm run build` przechodzi, a ręczny
przebieg z sekcji „Strategia testowania" domyka zachowania, których testy czyste nie obejmują.

### Kluczowe odkrycia

- **Delete musi przeżyć gałąź awarii.** `src/pages/teams/[id].astro:145-150` renderuje przycisk
  usuwania przy **każdym** istniejącym własnym wierszu — także gdy składu nie da się złożyć
  z dzisiejszą pulą (`inconsistent`) albo pula nie doszła. W tych stanach `TeamComposer` w ogóle
  się nie renderuje. Przeniesienie Delete do kolumny bocznej wyspy odebrałoby graczowi jedyną
  drogę do skasowania zepsutej drużyny — regresję, przed którą komentarz w pliku wprost ostrzega.
- **Embark musi mieszkać w wyspie.** Warunek „niezapisane zmiany" jest znany wyłącznie
  `TeamComposer`. Link w `.astro` nie ma jak go poznać — dwie wyspy nie dzielą stanu
  (`TeamComposer.tsx` docstring).
- **`teamId` jest jedynym nośnikiem trybu** (`CompositionGate.tsx:14-19`) i ma nim zostać.
  Grupa akcji w edytorze potrzebuje też nazwy drużyny, więc prop rozszerza się do jednego obiektu,
  a nie do drugiego, niezależnego pola.
- **Kolejność faz jest wymuszona treścią ekranu wyruszenia.** Oba nowe wejścia w Embark prowadzą
  na `/teams/[id]/embark`; dopóki ten ekran mówi „is saved", każda faza dokładająca wejście
  zostawia komunikat o zdarzeniu, które nie zaszło.
- **Strażniki grepowe w tym planie mają wymagania wstępne w postaci dwóch zamkniętych zmian**
  (`teams-list-as-home`, `app-shell-header-nav`). `context/foundation/lessons.md` §„Strażnik, który
  jest zielony na commicie bazowym, nie wiąże niczego" nakazuje uruchomić każdy strażnik na
  commicie bazowym i potwierdzić, że **czerwieni się tam**.

## Czego NIE robimy

- **Nie zmieniamy `/teams/new`.** Bez zapisanej drużyny nie ma czego usuwać ani z czym wyruszać;
  ekran tworzenia zachowuje dokładnie dzisiejszy jeden przycisk „Embark on the job".
- **Nie dotykamy tras zapisu.** `POST /api/teams`, `POST /api/teams/[id]`
  i `POST /api/teams/[id]/delete` zostają bez zmian — żadnego nowego trybu, parametru ani celu
  odesłania. Bramka progu (Guardrail „zapisana drużyna zawsze spełnia próg") nie zmienia kształtu.
  **Przyjęte ryzyko:** Faza 3 dokłada trasie usuwania **drugie wejście** (wiersz listy na `/`),
  a jej `reject()` odsyła na `/teams/${id}?error=…` (`src/pages/api/teams/[id]/delete.ts:49`) —
  cel zaprojektowany pod jedyne dotychczasowe wejście, czyli stronę drużyny. Nieudane usunięcie
  z listy wyrzuci więc gracza na stronę drużyny, a przy `null` z repo (wiersz zniknął w drugiej
  karcie) na `TeamNotFound`, który komunikatu z `?error=` nie pokazuje — goły 404 zamiast
  informacji, że usunięcie nie doszło. Naprawa wymagałaby rozróżnienia wejść w trasie, czyli
  dokładnie tego parametru, którego ta granica zabrania. Ryzyko przyjęte świadomie; pilnuje go
  ręczne kryterium 3.20.
- **Nie robimy „zapisz i wyrusz" jednym kliknięciem.** Embark nie zapisuje; przy niezapisanych
  zmianach odmawia.
- **Nie dodajemy prymitywu tooltip z shadcn.** Dymek to natywny `title`.
- **Nie zmieniamy reguły domenowej, schematu bazy, migracji ani RLS.** Ta zmiana nie dotyka
  `src/lib/domain/`, `supabase/` ani `src/lib/team-repo.ts`.
- **Nie zmieniamy nagłówka powłoki ani `src/lib/nav.ts`.** Trzy akcje są akcjami wiersza, nie
  pozycjami menu.
- **Nie dokładamy nowego ekranu wyruszenia** ani nie zmieniamy trasy `/teams/[id]/embark` —
  wyłącznie jej treść.
- **Nie robimy responsywności mobilnej** (Non-Goal PRD) ani audytu WCAG-AA — nazwy dostępne
  i dymki to konwencja repo, nie zobowiązanie zgodnościowe.

## Podejście do implementacji

Najpierw grunt bez nowych przycisków: dwa czyste moduły w `src/lib/` pod Vitestem plus
przeredagowanie ekranu wyruszenia. Dopiero potem dwa ekrany — edytor, potem lista — bo oba
konsumują ten sam moduł akcji i to samo okno potwierdzenia, a wersja sterowana okna powstaje
w edytorze, gdzie ma dziś jedynego użytkownika.

Logika trafia do `src/lib/`, a nie do komponentów, z tego samego powodu co `src/lib/nav.ts`:
nic pod testem nie może wciągać `astro:*` ani `@/lib/supabase` (AGENTS.md → Hard rules). Adresy
i nazwy dostępne akcji przestają być literałami rozsianymi po dwóch ekranach — rozjazd między listą
a edytorem czerwieni się wtedy w teście, a nie dopiero na ekranie.

## Krytyczne szczegóły implementacji

**Sekwencjonowanie stanu — wzajemna wyłączność dwóch przycisków usuwania.** Po Fazie 2 przycisk
usuwania renderuje się z dwóch miejsc: z kolumny bocznej wyspy (gałąź sukcesu) i z `.astro`
(gałąź awarii). Te dwa miejsca muszą być **strukturalnie** wykluczone, a nie wykluczone przez
zgodność dwóch niezależnych warunków — czyli przycisk gałęzi awarii ma stać **wewnątrz** gałęzi
`else` istniejącego wyrażenia warunkowego `composition !== null && pool !== null`
(`src/pages/teams/[id].astro:120-144`), nigdy obok niego z własnym, powtórzonym warunkiem.
Dwa niezależne warunki dają cichą awarię w obie strony (dwa przyciski albo zero), której nie łapie
ani lint, ani typy — to ta sama klasa co lekcja §„Wyspa bez `client:*` i flaga trybu odczytu"
z `context/foundation/lessons.md`.

**Specyfikacja doświadczenia użytkownika — co znaczy „niezapisane zmiany".** Porównanie jest
**zbiorowe, nie pozycyjne**: ten sam komplet postaci w innej kolejności slotów i ten sam komplet
perków wybrany w innej kolejności to **brak** zmian. Gracz, który zdejmie perk i wybierze go
z powrotem, ma z powrotem zapisany skład — Embark musi się wtedy odblokować. Porównanie pozycyjne
(`JSON.stringify`) blokowałoby przycisk po ruchu, który niczego nie zmienił.

## Faza 1: Fundament — czyste moduły i prawdziwa treść ekranu wyruszenia

### Przegląd

Powstają dwa czyste moduły z testami oraz przeredagowany ekran `/teams/[id]/embark`. Żadnego
nowego przycisku — po tej fazie aplikacja wygląda i zachowuje się jak dziś, poza treścią jednego
ekranu.

### Wymagane zmiany

#### 1. Opis trzech akcji drużyny

**Plik**: `src/lib/team-actions.ts` (nowy)

**Cel**: Jedno źródło prawdy o tym, jakie akcje ma zapisana drużyna, dokąd prowadzą i jak nazywają
się dla czytnika ekranu. Dziś adresy `/teams/<id>` i `/teams/<id>/embark` są literałami
w `index.astro` i w treściach ekranów; po tej fazie mieszkają w module objętym testem, z którego
korzystają oba ekrany.

**Umowa**: Eksportuje typ akcji jako **unię rozróżnialną**, w której „delete jako link" jest
niereprezentowalne: pozycje `embark` i `edit` niosą `href`, pozycja `delete` nie niesie go wcale.
Każda pozycja niesie `label` (tekst dla ekranu z etykietami) i `ariaLabel` (nazwa dostępna
przycisku ikonowego, zawierająca nazwę-hash drużyny, żeby wiersze listy dały się rozróżnić).
Funkcja wejściowa przyjmuje `{ id, name }` drużyny i zwraca trzy pozycje w kolejności
wyświetlania: embark, edit, delete.

Adresy: `embark` → `/teams/<id>/embark`, `edit` → `/teams/<id>`. Identyfikator wchodzi do adresu
**zakodowany** (`encodeURIComponent`) — dla poprawnego UUID kodowanie jest identycznością, ale
moduł nie zakłada, że dostał UUID, tak samo jak nie zakłada tego `src/pages/api/teams/[id].ts:38`.

Moduł jest czysty: bez `astro:*`, bez `@/lib/supabase`, bez importów z `src/pages/`.

#### 2. Test opisu akcji

**Plik**: `src/lib/team-actions.test.ts` (nowy)

**Cel**: Związać adresy, kolejność i kształt nazw dostępnych, żeby rozjazd między listą
a edytorem czerwienił się w `npm test`, a nie dopiero na ekranie.

**Umowa**: Wzorem `src/lib/nav.test.ts` asercje są wyrażone **literałami**, nie odczytami
z eksportowanych stałych — asercja podążająca za mutacją stałej przestaje cokolwiek wiązać.
Pokrywa: trzy pozycje w ustalonej kolejności; `href` obecny dokładnie przy `embark` i `edit`;
nazwa dostępna każdej pozycji zawiera nazwę-hash drużyny; identyfikator wymagający kodowania
nie trafia do adresu surowy.

#### 3. Wykrycie niezapisanych zmian składu

**Plik**: `src/lib/composition-changes.ts` (nowy)

**Cel**: Rozstrzygnąć, czy skład widoczny w wyspie różni się od tego, który jest w bazie —
jedyny warunek, od którego zależy blokada nowego przycisku Embark w edytorze.

**Umowa**: Jedna funkcja przyjmująca dwa `TeamComposition` (bieżący i zapisany) i zwracająca
`boolean`. Porównanie **zbiorowe, nie pozycyjne**, na obu poziomach: komplet `characterId`
niezależnie od kolejności slotów, a dla każdego członka komplet `perkIds` niezależnie od kolejności
wyboru (patrz „Krytyczne szczegóły implementacji"). Moduł jest czysty: importuje wyłącznie typy
z `@/lib/domain`, bez `astro:*` i bez `@/lib/supabase`.

Umiejscowienie: `src/lib/`, nie `src/lib/domain/` — funkcja nie dokłada reguły domenowej, tylko
porównuje dwa jej wejścia, tak jak `src/lib/team-view.ts` tylko czyta jej werdykt.

#### 4. Test wykrycia niezapisanych zmian

**Plik**: `src/lib/composition-changes.test.ts` (nowy)

**Cel**: Związać semantykę zbiorową — to jedyna nowa **logika** tej zmiany i jedyna bariera przed
cichą utratą pracy gracza.

**Umowa**: Pokrywa co najmniej: identyczny skład → brak zmian; inna kolejność członków przy tym
samym komplecie → brak zmian; ta sama postać z tymi samymi perkami w innej kolejności → brak zmian;
dodany członek, usunięty członek, wymieniony członek → zmiana; dołożony perk, zdjęty perk,
podmieniony perk u istniejącego członka → zmiana; pusty skład wobec niepustego → zmiana; dwa puste
składy → brak zmian.

#### 5. Ekran wyruszenia mówiący prawdę o obu wejściach

**Plik**: `src/pages/teams/[id]/embark.astro`

**Cel**: Ekran jest od tej fazy osiągalny na dwa sposoby: tuż po zapisie (dziś) i z ikony Embark
(Fazy 2 i 3). Treść ma być prawdziwa w obu przypadkach — nie może twierdzić, że gracz właśnie
zapisał drużynę, gdy przyszedł z listy.

**Umowa**: Zmienia się **wyłącznie treść** sekcji potwierdzenia — tytuł strony, nagłówek i akapit
wiodący. Struktura frontmattera, odczyt `getTeamSummary`, gałąź 404 przez `Astro.response.status`,
gałąź awarii i blok „Work in Progress" (FR-019) zostają nietknięte. Nowy tekst musi jednocześnie:
nazwać drużynę jej nazwą-hash, potwierdzić **trwałość** zapisu (nazwa czytana z bazy jest dowodem
trwałości, nie echem adresu — FR-019 wymaga potwierdzenia zapisu) i nie orzekać o zdarzeniu, które
mogło nie zajść w tym żądaniu. Nowa treść — tytuł strony, nagłówek i akapit wiodący — nie używa
słowa „saved" w żadnym z tych trzech miejsc; trwałość nazywa orzeczeniem o stanie („on the books"),
nie o czynności gracza. Blok „Work in Progress" zostaje dosłownie — to on niesie granicę
projektu.

Komentarz frontmattera odnotowuje, że ekran ma od tej zmiany dwa wejścia — inaczej następna osoba
przywróci sformułowanie zorientowane wyłącznie na zapis.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Typy wygenerowane: `npx astro sync`
- Linting przechodzi: `npm run lint`
- Testy przechodzą, łącznie z dwoma nowymi plikami: `npm test`
- Oba moduły istnieją i są czyste (uruchamiane jako jedna komenda, żeby brak pliku był czerwony,
  a nie cicho pomijany przez `grep` na nieistniejącej ścieżce):
  `test -f src/lib/team-actions.ts && test -f src/lib/composition-changes.ts && ! grep -nE '(from|import\()\s*"(astro:|@/lib/supabase)' src/lib/team-actions.ts src/lib/composition-changes.ts`
  — wzorzec obejmuje import statyczny, dynamiczny i re-eksport (`export * from`), zgodnie
  z `lessons.md` §„Strażnik grepowy nad JSX/TS"
- Oba pliki testowe istnieją: `test -f src/lib/team-actions.test.ts && test -f src/lib/composition-changes.test.ts`
- Ekran wyruszenia nie twierdzi już, że gracz właśnie zapisał:
  `! grep -nE '\bsaved\b' 'src/pages/teams/[id]/embark.astro'`
  — strażnik **musi** zostać uruchomiony na commicie bazowym i czerwienić się tam
  (`git grep -nE '\bsaved\b' HEAD -- 'src/pages/teams/[id]/embark.astro'` zwraca dziś **dwa**
  trafienia: nagłówek `:62` („… is saved") i tytuł strony `:56` (`Team ${team.name} saved`).
  Wąskie `is saved` trafiało wyłącznie w nagłówek i przepuszczało tytuł, który orzeka o dokładnie
  tym samym zdarzeniu — stąd kotwica na słowie, nie na frazie (`lessons.md` §„Kryteria grepowe
  kotwicz na składni, nie na słowach"). Zielony na bazie znaczyłby, że nie wiąże niczego
- Blok „Work in Progress" przetrwał redakcję:
  `grep -n 'Work in Progress' src/pages/teams/[id]/embark.astro`

#### Ręczna weryfikacja

- `/teams/new` → zapis domkniętej drużyny → ekran wyruszenia zawiera zdanie orzekające o **stanie**
  („drużyna jest zapisana / jest na liście"), a nie o **czynności gracza** („właśnie zapisałeś"),
  nazywa drużynę nazwą-hash odczytaną z bazy i nadal pokazuje „Work in Progress" (FR-019).
  To jest sprawdzalny kształt wymagania: orzeczenie o stanie jest prawdziwe przy obu wejściach,
  a nazwa z bazy jest tym, co odróżnia potwierdzenie zapisu od echa adresu
- Wejście na `/teams/<id>/embark` przez wpisanie adresu (bez uprzedniego zapisu) daje tekst, który
  nie kłamie o zdarzeniu
- Cudze i nieistniejące `<id>` nadal dają ekran 404 (`TeamNotFound`), bez zmian wobec dziś

**Uwaga implementacyjna**: Po zakończeniu tej fazy i przejściu wszystkich automatycznych
weryfikacji zatrzymaj się na ręczne potwierdzenie przez człowieka, zanim przejdziesz do Fazy 2.

---

## Faza 2: Akcje w kolumnie bocznej edytora `/teams/[id]`

### Przegląd

`DeleteTeamDialog` rozdziela się na sterowane okno i osobny wyzwalacz. W kolumnie bocznej pod
`CompositionGate` staje grupa akcji: Embark (zablokowany przy niezapisanych zmianach) i Delete team,
obie z ikoną i etykietą. Gałąź awarii `/teams/[id]` zachowuje własny przycisk usuwania.

### Wymagane zmiany

#### 1. Okno potwierdzenia jako komponent sterowany

**Plik**: `src/components/team/DeleteTeamDialog.tsx`

**Cel**: Rozdzielić „co potwierdzamy" od „skąd otwarto", żeby Faza 3 mogła postawić jedno okno nad
listą N wierszy. Dziś komponent trzyma `open` sam i sam renderuje swój wyzwalacz, więc jedynym
sposobem na wiele wyzwalaczy byłoby wiele okien.

**Umowa**: Komponent przyjmuje cel usuwania oraz sterowanie widocznością od rodzica. Cel jest
**jednym obiektem** (`{ id, name }`), a nie dwoma polami — „id bez nazwy" i „nazwa bez id" mają
pozostać niereprezentowalne, tą samą logiką co `teamId` w `CompositionGate.tsx:14-19`. Gdy celu nie
ma, okno nie renderuje treści.

Komponent **przestaje** renderować własny przycisk otwierający. Stan `submitting` zostaje w środku —
to własność wysyłki, nie rodzica.

Wszystko, przed czym broni się dziś docstring, zostaje bez zmian i ma zostać w komentarzu:
prymityw `alert-dialog` (nie `dialog`), potwierdzenie jako **zwykły submit** zamiast
`AlertDialogAction` (bezwarunkowe `onOpenChange(false)` z `DialogPrimitive.Close` odłączyłoby
przycisk od formularza i POST nie wyszedłby — bez błędu), formularz **wewnątrz** treści okna
(Radix portuje ją do `document.body`), nadpisujące `className` nad jasnymi tokenami shadcn.

#### 2. Grupa akcji zapisanej drużyny

**Plik**: `src/components/team/TeamActions.tsx` (nowy)

**Cel**: Jedno miejsce, w którym stoją akcje dotyczące **istniejącej** drużyny — wyruszenie
i usunięcie. Powstaje osobno od `CompositionGate`, bo bramka istnieje dla progu i `disabled`, a nie
dla etykiet; wciągnięcie do niej dwóch akcji niezwiązanych z progiem rozmyłoby jej powód istnienia.

**Umowa**: Przyjmuje cel (`{ id, name }`) oraz informację, czy widoczny skład ma niezapisane
zmiany. Renderuje dwa przyciski z ikoną **i etykietą** (decyzja: ikony bez tekstu tylko w wierszu
listy): „Embark on the job" jako link oraz „Delete team" jako wyzwalacz okna. Adresy i teksty biorą
się z `@/lib/team-actions`, nie z literałów.

Przy niezapisanych zmianach Embark jest nieaktywny i **niesie powód**: statyczny tekst pod
przyciskiem mówi, że trzeba najpierw zapisać zmiany. Nie tooltip — `Button` ma
`disabled:pointer-events-none`, więc dymek na wyłączonym przycisku nigdy się nie pokaże (ta sama
pułapka, którą odnotowuje `CompositionGate.tsx` docstring). Nieaktywny link nie jest `<a>`
z `aria-disabled` — nieaktywny stan wyraża `<button disabled>`, bo tylko on jest rzeczywiście
nieklikalny i nienawigowalny klawiaturą.

Komponent trzyma stan `open` okna i przekazuje go do `DeleteTeamDialog`.

#### 3. Wpięcie grupy akcji w wyspę kompozytora

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Postawić grupę akcji pod `CompositionGate` w kolumnie bocznej i podać jej warunek
„niezapisane zmiany", który zna wyłącznie wyspa.

**Umowa**: Prop `teamId?: string` ustępuje miejsca jednemu propowi opisującemu zapisaną drużynę
(`{ id, name }`), z którego wyspa wyprowadza `teamId` dla `CompositionGate` — nośnik trybu pozostaje
jeden, a „edycja bez nazwy" jest niereprezentowalna. Brak propu nadal znaczy „kompletowanie nowej
drużyny" i `/teams/new` nie dostaje ani grupy akcji, ani przycisku usuwania.

Warunek niezapisanych zmian liczy `hasUnsavedChanges` z Fazy 1, porównując bieżący `composition`
z `initialComposition`. Liczony przy każdym renderze, bez memoizacji — dokładnie jak `evaluateTeam`
(react-compiler; koszt to porównanie ≤ 6 członków, NFR 200 ms z zapasem).

Grupa akcji renderuje się **wyłącznie** przy obecnym propie zapisanej drużyny, jako ostatni element
kolumny bocznej, pod `CompositionGate`.

#### 4. Uporządkowanie akcji na stronie edycji

**Plik**: `src/pages/teams/[id].astro`

**Cel**: Usunąć przycisk usuwania spod całej siatki i zastąpić go dwoma wzajemnie wykluczającymi się
przypadkami: w gałęzi sukcesu akcje niesie wyspa, w gałęzi awarii — własny przycisk, żeby zepsutą
drużynę nadal dało się skasować.

**Umowa**: Blok `{team !== null && (<div class="mt-4 flex flex-col">…)}` (linie 151-155) znika
w całości. `TeamComposer` dostaje prop zapisanej drużyny zamiast `teamId`. Przycisk usuwania dla
gałęzi awarii ląduje **wewnątrz** gałęzi `else` istniejącego wyrażenia
`composition !== null && pool !== null` — nie obok niego z powtórzonym warunkiem (patrz „Krytyczne
szczegóły implementacji"). Ta gałąź renderuje wyzwalacz i okno jako osobną wyspę `client:load`;
`team !== null` pozostaje jej warunkiem, bo przy `teamFailed` nie ma czego usuwać, a sam przycisk
zdradziłby istnienie wiersza (US-04).

Komentarz przy tym miejscu zostaje i zostaje zaktualizowany: ma dalej tłumaczyć, dlaczego usuwanie
żyje także wtedy, gdy składu nie da się złożyć — i dlaczego renderuje się z dwóch miejsc.

#### 5. Wyzwalacz usuwania dla gałęzi awarii

**Plik**: `src/components/team/DeleteTeamButton.tsx` (nowy)

**Cel**: Dać `.astro` samodzielny przycisk usuwania z własnym stanem okna, skoro `DeleteTeamDialog`
przestał go renderować. Bez tego gałąź awarii musiałaby trzymać stan w `.astro`, co nie jest możliwe.

**Umowa**: Przyjmuje cel (`{ id, name }`), trzyma `open`, renderuje wyzwalacz z ikoną i etykietą
„Delete team" oraz `DeleteTeamDialog`. Etykieta i nazwa dostępna biorą się z `@/lib/team-actions`.
To jest jedyny konsument tego komponentu — `TeamActions` ma własny wyzwalacz osadzony w grupie.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Typy, linting i testy: `npx astro sync && npm run lint && npm test`
- Nowe komponenty istnieją: `test -f src/components/team/TeamActions.tsx && test -f src/components/team/DeleteTeamButton.tsx`
- Okno jest sterowane z zewnątrz (strażnik czerwony na commicie bazowym — dziś `DeleteTeamDialog`
  nie ma takiego propu):
  `grep -nE '^\s*onOpenChange' src/components/team/DeleteTeamDialog.tsx`
- Okno nie jest już właścicielem stanu otwarcia (a więc i własnego wyzwalacza):
  `! grep -nE 'const \[open, setOpen\] = useState' src/components/team/DeleteTeamDialog.tsx`
  — uruchom na commicie bazowym i potwierdź czerwień (linia 43). Kotwica celuje we **właściciela
  stanu**, nie w wywołanie settera: `! grep 'setOpen\(true\)'` przechodziło po zwykłej zmianie
  nazwy settera, a samo 2.3 przechodzi także wtedy, gdy komponent zachowa `useState` i tylko
  dorzuci prop. `submitting` zostaje w środku i tego wzorca nie narusza
- Adresy akcji nie są literałami w komponentach edytora:
  `! grep -nE '/teams/\$\{|"/teams/' src/components/team/TeamActions.tsx`
- Przycisk usuwania zniknął spod siatki na stronie edycji:
  `! grep -n 'mt-4 flex flex-col' src/pages/teams/\[id\].astro`
  — uruchom na commicie bazowym i potwierdź, że czerwieni się tam (linia 152)
- `/teams/new` nie dostał ani grupy akcji, ani usuwania:
  `! grep -nE 'TeamActions|DeleteTeam' src/pages/teams/new.astro`
  — ten strażnik jest **zielony na bazie** świadomie: pilnuje, żeby faza nie rozlała się na ekran
  tworzenia, więc jego wartością jest czerwień przy regresji, nie przy starcie

#### Ręczna weryfikacja

- `/teams/<id>`: pod wykresem i licznikiem braków stoją kolejno „Save changes", „Embark on the job",
  „Delete team"; żaden przycisk nie wisi już pod całą siatką
- Bez ruszania składu: „Embark on the job" jest aktywny i prowadzi na ekran wyruszenia tej drużyny
- Po zmianie składu (dodanie, usunięcie członka albo przełączenie perka): Embark gaśnie i pokazuje
  powód; „Save changes" nadal działa; po zapisie i powrocie Embark jest z powrotem aktywny
- Zdjęcie perka i wybranie go z powrotem **odblokowuje** Embark — porównanie jest zbiorowe
- Skład poniżej progu: „Save changes" nieaktywny z dotychczasowym komunikatem, a stan Embark zależy
  wyłącznie od niezapisanych zmian, nie od progu
- „Delete team" otwiera okno z nazwą drużyny; „Cancel" zostawia drużynę nietkniętą (US-03),
  potwierdzenie odsyła na `/` z banerem „Team deleted."
- Drużyna, której składu nie da się złożyć z dzisiejszą pulą (stan `inconsistent`), **nadal ma**
  przycisk usuwania i nadal daje się skasować
- Cudze `<id>` nadal daje 404 bez żadnego z nowych przycisków
- `/teams/new` wygląda i działa dokładnie jak przed zmianą

**Uwaga implementacyjna**: Zatrzymaj się tutaj na ręczne potwierdzenie przez człowieka przed
przejściem do Fazy 3.

---

## Faza 3: Ikonowe akcje w wierszu listy na `/`

### Przegląd

Wiersz listy przestaje być jednym linkiem: nazwa-hash zostaje linkiem, obok stają trzy ikonowe
przyciski bez tekstu. Lista przechodzi do jednej wyspy React z jednym oknem potwierdzenia na całą
listę.

### Wymagane zmiany

#### 1. Lista drużyn jako wyspa z akcjami

**Plik**: `src/components/team/TeamList.tsx` (nowy)

**Cel**: Wyrazić wiersz z trzema akcjami i jedno okno potwierdzenia nad całą listą — jeden punkt
hydratacji i jedno okno w DOM niezależnie od liczby drużyn (FR-006 nie stawia limitu).

**Umowa**: Przyjmuje gotowe wiersze w kształcie, w jakim strona je dziś składa
(`{ id, name, savedAt }` — data **już sformatowana**, patrz punkt 2). Renderuje listę kart o tym
samym wyglądzie co dziś: nazwa-hash jako link do drużyny, data zapisu, a po prawej trzy przyciski.

Wszystkie trzy akcje pochodzą z `@/lib/team-actions`: `embark` i `edit` są linkami (`<a>` ostylowany
przez `buttonVariants` z `size: "icon"` i wariantem `ghost`), `delete` jest przyciskiem otwierającym
wspólne okno. Ikony: `Rocket`, `Pencil`, `Trash2` z `lucide-react` — pierwsza i trzecia są już
w użyciu (`CompositionGate.tsx`, `DeleteTeamDialog.tsx`), więc język wizualny się nie rozjeżdża.

Każdy przycisk niesie `aria-label` z `@/lib/team-actions` (zawiera nazwę drużyny, więc czytnik
rozróżnia wiersze) **oraz** `title` z tym samym tekstem — dymek dla myszy.

Komponent trzyma jeden stan celu usuwania (`{ id, name } | null`) i jedno `DeleteTeamDialog`
poza pętlą wierszy. Kliknięcie ikony kosza ustawia cel i otwiera okno; zamknięcie czyści cel.

Wiersz **nie jest** opakowany w link i nie używa wzorca „stretched link" — poza nazwą i trzema
ikonami nic w karcie nie jest klikalne. Klasy składane przez `cn()`, nigdy przez sklejanie łańcuchów
(AGENTS.md → Conventions).

#### 2. Strona główna oddaje markup listy wyspie

**Plik**: `src/pages/index.astro`

**Cel**: Zachować całe dzisiejsze zachowanie odczytu i wszystkie stany strony, oddając wyspie
wyłącznie markup **niepustej** listy.

**Umowa**: Frontmatter zostaje bez zmian co do joty: odczyt `listTeams`, rozróżnienie
`null` (awaria) od `[]` (nowe konto), formatowanie daty przez `Intl.DateTimeFormat` **przy
odczycie** (`format` rzuca `RangeError` na `Invalid Date`, a w szablonie taki wyjątek wywróciłby
render, czyli 500 w Workerze), baner `?deleted=1`, gałąź `!supabase`.

Zmienia się wyłącznie gałąź „lista niepusta": zamiast `<ul>` z kartami-linkami renderuje
`<TeamList teams={teams} client:load />`. Gałąź awarii, gałąź stanu pustego (`teams.length === 0`),
baner usunięcia i link „Assemble a new team" zostają w `.astro` i **nie** wchodzą do wyspy —
to statyczny markup, który nie ma powodu być hydratowany.

Komentarz na górze pliku odnotowuje, że strona przestała być czystym SSR i dlaczego (okno
potwierdzenia FR-010 wymaga JavaScriptu) — inaczej następna osoba przeczyta dzisiejszą notę
„zero `client:*`" jako nadal obowiązującą.

### Kryteria sukcesu

#### Automatyczna weryfikacja

- Typy, linting, testy i build: `npx astro sync && npm run lint && npm test && npm run build`
- Wyspa listy istnieje: `test -f src/components/team/TeamList.tsx`
- Strona główna hydratuje listę (strażnik czerwony na bazie — `index.astro` nie ma dziś ani jednej
  dyrektywy `client:*`): `grep -nE 'client:[a-z]+' src/pages/index.astro`
- Markup wiersza opuścił `.astro` — żadnego adresu drużyny w stronie głównej:
  `! grep -nE 'teams/\$\{' src/pages/index.astro`
  — uruchom na commicie bazowym i potwierdź czerwień (linia 106); wzorzec kotwiczy się na
  interpolacji, więc łapie `href="…"`, `href={"…"}` i formę z odwrotnymi apostrofami naraz
  (`lessons.md` §„Strażnik grepowy nad JSX/TS")
- Trzy akcje mają nazwy dostępne i dymki, i biorą je **z modułu**, nie z literałów — kryterium
  liczy wystąpienia odczytu `ariaLabel` (trzy `aria-label` + trzy `title` = 6):
  `test "$(grep -cE '(aria-label|title)=\{[A-Za-z_$][A-Za-z0-9_$]*\.ariaLabel\}' src/components/team/TeamList.tsx)" -ge 6`
  — gołe `grep -c 'aria-label' … -ge 3` nie wiązałoby **akcji**, tylko wystąpienia łańcucha:
  repo stawia `aria-label` także na `<ul>` (`MemberPickerDialog.tsx:63`) i na `<svg>`
  (`CompetencyRadar.tsx:30`), a `title=` występuje dziś wyłącznie jako prop layoutu
  (`AppLayout title=`), więc oba liczniki dałyby się domknąć bez ani jednej nazwanej ikony
- Samą treść nazw dostępnych wiąże `src/lib/team-actions.test.ts` (Faza 1 punkt 2): trzy pozycje,
  każda z niepustym `ariaLabel` zawierającym nazwę-hash drużyny — asercja, nie licznik
- Adresy akcji nie są literałami w wyspie:
  `! grep -nE '/teams/\$\{|"/teams/' src/components/team/TeamList.tsx`
- Stan pusty i baner usunięcia zostały w `.astro`:
  `grep -n 'No crew on the books yet' src/pages/index.astro && grep -n 'Team deleted' src/pages/index.astro`

#### Ręczna weryfikacja

- `/` z co najmniej dwiema drużynami: każdy wiersz pokazuje nazwę-hash jako link, datę zapisu
  i trzy ikony bez tekstu
- Najechanie na każdą z trzech ikon pokazuje dymek nazywający akcję wraz z nazwą drużyny
- Tab przechodzi przez wiersz w kolejności: nazwa → Embark → Edit → Delete, każdy element ma
  widoczny pierścień fokusu; nie ma elementu, który łapie fokus bez powodu
- Ikona Embark prowadzi na ekran wyruszenia **tej** drużyny, z treścią przeredagowaną w Fazie 1
- Ikona Edit prowadzi na `/teams/<id>`, tak samo jak kliknięcie nazwy
- Ikona kosza otwiera okno z nazwą **klikniętego** wiersza — sprawdzone na co najmniej dwóch
  różnych wierszach pod rząd, żeby wykluczyć zapamiętany cel
- „Cancel" zostawia drużynę na liście; potwierdzenie usuwa właściwą drużynę i pokazuje baner
  „Team deleted."
- Usunięcie ostatniej drużyny przywraca stan pusty z wezwaniem do utworzenia nowej (US-03)
  i banerem usunięcia
- Konto bez drużyn nadal widzi stan pusty z wyjaśnieniem, a nie zero wyników (US-01)
- Awaria odczytu (np. przy odciętym Supabase) nadal pokazuje ekran „Your teams are unavailable
  right now" bez banera usunięcia
- Zaznaczanie tekstu nazwy-hasza myszą działa — karta nie jest jednym wielkim linkiem
- Nieudane usunięcie z listy (np. przy odciętym Supabase albo po skasowaniu tej samej drużyny
  w drugiej karcie) kończy się na stronie drużyny lub na 404 — potwierdź, że zachowanie jest
  dokładnie takie, jak opisuje przyjęte ryzyko w „Czego NIE robimy", i że drużyna **nie** znika
  z listy po powrocie na `/`

**Uwaga implementacyjna**: Zatrzymaj się na ręczne potwierdzenie przez człowieka przed zamknięciem
zmiany.

---

## Strategia testowania

### Testy jednostkowe

Vitest, `src/**/*.test.ts`, wyłącznie kod czysty — nic pod testem nie może importować `astro:*`
ani `@/lib/supabase` (AGENTS.md → Hard rules). `zod` pozostaje poza zależnościami.

- `src/lib/team-actions.test.ts` — kolejność trzech akcji; obecność `href` dokładnie przy `embark`
  i `edit`; adresy dokładne co do znaku; nazwa dostępna zawiera nazwę-hash; identyfikator wymagający
  kodowania nie trafia do adresu surowy. Asercje literałami, nie odczytami ze stałych
  (wzorzec `src/lib/nav.test.ts`).
- `src/lib/composition-changes.test.ts` — przypadki brzegowe semantyki zbiorowej wymienione
  w Fazie 1 punkt 4, ze szczególnym naciskiem na dwa, które łatwo zgubić: inna kolejność członków
  oraz zdjęcie i ponowny wybór tego samego perka.

Komponenty React i strony `.astro` nie dostają testów — repo nie ma dziś ani jednego testu
komponentu i nie ma runnera DOM; dokładanie go wykracza poza tę zmianę (strategia testowania
i bramki jakości należą do Modułu 3).

### Testy integracyjne

Brak automatycznych — to zmiana interfejsu, a repo nie ma dziś warstwy end-to-end. Rolę tę pełni
ręczna ścieżka niżej.

### Kroki testowania ręcznego

1. `nvm use && hash -r` (powłoka startuje z Node 20; `astro sync` na nim pada), potem
   `npx astro sync && npm run lint && npm test && npm run build`.
2. `npm run dev`, zaloguj się na konto z co najmniej dwiema zapisanymi drużynami.
3. `/` — sprawdź trzy ikony w każdym wierszu, dymki, kolejność Tab, zaznaczanie nazwy myszą.
4. Ikona Embark w pierwszym wierszu → ekran wyruszenia tej drużyny; treść nie twierdzi, że właśnie
   zapisałeś.
5. Wróć na `/`, ikona kosza w **drugim** wierszu → okno nazywa drugą drużynę, „Cancel" nic nie
   zmienia.
6. Ikona kosza w pierwszym wierszu → okno nazywa pierwszą drużynę → potwierdź → `/` z banerem
   „Team deleted.", właściwa drużyna zniknęła.
7. Ikona Edit → `/teams/<id>`: grupa akcji pod wykresem, kolejność Save / Embark / Delete.
8. Zmień skład (usuń członka) → Embark gaśnie z powodem; przywróć tego samego członka → Embark
   wraca. Zdejmij i wybierz z powrotem ten sam perk → Embark wraca.
9. Zejdź poniżej progu → „Save changes" nieaktywny z komunikatem progu; zapisz po domknięciu progu
   → baner „Roster saved.".
10. Usuń drużynę z poziomu edytora → `/` z banerem; powtórz aż do usunięcia ostatniej → stan pusty
    z wezwaniem do utworzenia nowej.
11. `/teams/new` — sprawdź, że ekran tworzenia nie ma ani Embark-linku, ani przycisku usuwania,
    i że zapis działa jak przed zmianą.
12. Wyloguj się i wejdź na `/` oraz na `/teams/<id>` — przekierowanie na logowanie (FR-004).
13. Zaloguj się na **drugie** konto i wejdź na `<id>` drużyny pierwszego konta — 404 bez żadnego
    z nowych przycisków (US-04).

## Uwagi dotyczące wydajności

`hasUnsavedChanges` liczy się przy każdym renderze wyspy, bez memoizacji — dokładnie jak
`evaluateTeam` (`TeamComposer.tsx` docstring): react-compiler robi to sam, a koszt to porównanie
dwóch składów po co najwyżej sześciu członkach i dwóch perkach każdy. NFR „poniżej 200 ms od
wyboru" zostaje z zapasem.

Strona główna przestaje być stroną bez JavaScriptu — to jest cena okna potwierdzenia (FR-010),
przyjęta świadomie. Hydratacja jest **jedna** niezależnie od liczby drużyn, bo lista jest jedną
wyspą z jednym oknem; wariant „wyspa per wiersz" został odrzucony właśnie dlatego, że FR-006
nie stawia limitu drużyn na konto.

## Uwagi dotyczące migracji

Brak. Zmiana nie dotyka bazy, migracji, RLS ani kształtu danych — `supabase/` i `src/lib/team-repo.ts`
zostają nietknięte. Nie ma stanu do przeniesienia i nie ma czego wycofywać poza `git revert`.

## Referencje

- Zgłoszenie i rozstrzygnięcia: `context/changes/2026-09-06-team-action-buttons/change.md`
- Skrót decyzji: `context/changes/2026-09-06-team-action-buttons/plan-brief.md`
- Powtarzające się lekcje (strażniki grepowe, para „dyrektywa hydratacji + flaga trybu"):
  `context/foundation/lessons.md`
- Wzorzec czystego modułu pod testem: `src/lib/nav.ts`, `src/lib/nav.test.ts`
- Dzisiejszy wiersz listy: `src/pages/index.astro:105-112`
- Dzisiejsze umiejscowienie usuwania: `src/pages/teams/[id].astro:145-155`
- Bramka progu, której ta zmiana nie dotyka: `src/components/team/CompositionGate.tsx`
- Zmiany poprzedzające: `context/archive/2026-09-06-teams-list-as-home/`,
  `context/archive/2026-09-06-app-shell-header-nav/`, `context/archive/2026-09-06-delete-team-confirmed/`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. `[x]` znaczy „komenda uruchomiona i zielona", nie „intencja
> spełniona" — a każdy strażnik negatywny musi wcześniej czerwienić się na commicie bazowym
> (`context/foundation/lessons.md`).

### Faza 1: Fundament — czyste moduły i prawdziwa treść ekranu wyruszenia

#### Automatyczne

- [x] 1.1 Typy wygenerowane: `npx astro sync` — 82cc70f
- [x] 1.2 Linting przechodzi: `npm run lint` — 82cc70f
- [x] 1.3 Testy przechodzą, łącznie z dwoma nowymi plikami: `npm test` — 82cc70f
- [x] 1.4 Oba moduły istnieją i są czyste (`test -f` + strażnik importów) — 82cc70f
- [x] 1.5 Oba pliki testowe istnieją — 82cc70f
- [x] 1.6 Ekran wyruszenia nie twierdzi już, że gracz właśnie zapisał (strażnik czerwony na bazie) — 82cc70f
- [x] 1.7 Blok „Work in Progress" przetrwał redakcję — 82cc70f

#### Ręczne

- [x] 1.8 Ekran po zapisie orzeka o stanie (nie o czynności gracza), nazywa drużynę z bazy i pokazuje „Work in Progress" — 82cc70f
- [x] 1.9 Wejście na ekran wyruszenia bez uprzedniego zapisu daje tekst, który nie kłamie — 82cc70f
- [x] 1.10 Cudze i nieistniejące `<id>` nadal dają ekran 404 — 82cc70f

### Faza 2: Akcje w kolumnie bocznej edytora `/teams/[id]`

#### Automatyczne

- [x] 2.1 Typy, linting i testy: `npx astro sync && npm run lint && npm test` — 2ccfa43
- [x] 2.2 Nowe komponenty istnieją (`TeamActions.tsx`, `DeleteTeamButton.tsx`) — 2ccfa43
- [x] 2.3 Okno jest sterowane z zewnątrz (strażnik czerwony na bazie) — 2ccfa43
- [x] 2.4 Okno nie jest właścicielem stanu otwarcia (strażnik czerwony na bazie, linia 43) — 2ccfa43
- [x] 2.5 Adresy akcji nie są literałami w `TeamActions.tsx` — 2ccfa43
- [x] 2.6 Przycisk usuwania zniknął spod siatki na stronie edycji (strażnik czerwony na bazie) — 2ccfa43
- [x] 2.7 `/teams/new` nie dostał ani grupy akcji, ani usuwania — 2ccfa43

#### Ręczne

- [x] 2.8 Kolejność Save / Embark / Delete w kolumnie bocznej; nic nie wisi pod siatką — 2ccfa43
- [x] 2.9 Bez zmian składu Embark aktywny i prowadzi na ekran wyruszenia tej drużyny — 2ccfa43
- [x] 2.10 Po zmianie składu Embark gaśnie z powodem; po zapisie wraca — 2ccfa43
- [x] 2.11 Zdjęcie i ponowny wybór tego samego perka odblokowuje Embark — 2ccfa43
- [x] 2.12 Poniżej progu Save nieaktywny; stan Embark niezależny od progu — 2ccfa43
- [x] 2.13 Delete otwiera okno z nazwą drużyny; Cancel nie zmienia nic, potwierdzenie odsyła na `/` — 2ccfa43
- [x] 2.14 Drużyna w stanie `inconsistent` nadal ma przycisk usuwania i daje się skasować — 2ccfa43
- [x] 2.15 Cudze `<id>` nadal daje 404 bez nowych przycisków — 2ccfa43
- [x] 2.16 `/teams/new` działa dokładnie jak przed zmianą — 2ccfa43

### Faza 3: Ikonowe akcje w wierszu listy na `/`

#### Automatyczne

- [x] 3.1 Typy, linting, testy i build: `npx astro sync && npm run lint && npm test && npm run build`
- [x] 3.2 Wyspa listy istnieje: `test -f src/components/team/TeamList.tsx`
- [x] 3.3 Strona główna hydratuje listę (strażnik czerwony na bazie)
- [x] 3.4 Żadnego adresu drużyny w `src/pages/index.astro` (strażnik czerwony na bazie)
- [x] 3.5 Trzy akcje biorą nazwy dostępne i dymki z modułu (odczyty `.ariaLabel` ≥ 6)
- [x] 3.6 Treść nazw dostępnych związana asercją w `team-actions.test.ts`, nie licznikiem
- [x] 3.7 Adresy akcji nie są literałami w `TeamList.tsx`
- [x] 3.8 Stan pusty i baner usunięcia zostały w `.astro`

#### Ręczne

- [x] 3.9 Wiersz pokazuje nazwę jako link, datę i trzy ikony bez tekstu
- [x] 3.10 Dymek każdej z trzech ikon nazywa akcję wraz z nazwą drużyny
- [x] 3.11 Kolejność Tab: nazwa → Embark → Edit → Delete, z widocznym fokusem
- [x] 3.12 Ikona Embark prowadzi na ekran wyruszenia tej drużyny
- [x] 3.13 Ikona Edit prowadzi na `/teams/<id>`, tak jak kliknięcie nazwy
- [x] 3.14 Okno usuwania nazywa **kliknięty** wiersz — sprawdzone na dwóch różnych pod rząd
- [x] 3.15 Cancel zostawia drużynę; potwierdzenie usuwa właściwą i pokazuje baner
- [x] 3.16 Usunięcie ostatniej drużyny przywraca stan pusty z wezwaniem
- [x] 3.17 Konto bez drużyn widzi stan pusty z wyjaśnieniem
- [x] 3.18 Awaria odczytu pokazuje ekran „unavailable" bez banera usunięcia
- [x] 3.19 Zaznaczanie tekstu nazwy-hasza myszą działa
- [x] 3.20 Nieudane usunięcie z listy zachowuje się zgodnie z przyjętym ryzykiem; drużyna zostaje
