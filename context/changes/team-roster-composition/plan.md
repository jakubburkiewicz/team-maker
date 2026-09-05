# Plan implementacji: Kompletowanie składu drużyny z okna wyboru członka (S-01)

## Przegląd

Pierwszy ekran domenowy projektu: strona `/teams/new`, na której zalogowany gracz kompletuje
nową drużynę z zamkniętej puli dwunastu postaci. Otwiera okno wyboru członka (lista po lewej,
szczegóły po prawej), dodaje do sześciu różnych postaci, usuwa członka i przez cały czas widzi
aktualny skład w sześciu slotach. Limity „maksimum sześciu członków" i „brak powtórzeń" są
egzekwowane w czystym, testowanym module domenowym, a nie tylko chowane w interfejsie — to
ryzyko, które roadmapa nazywa wprost przy S-01.

Bez perków i wykresu (S-02), bez zapisu (S-03). Kompletowana drużyna żyje wyłącznie w pamięci
wyspy React i nie przeżywa odświeżenia strony (rozstrzygnięcie niewiadomej z roadmapy).

## Analiza stanu obecnego

**Warstwa domeny i danych jest gotowa (F-01, F-02):**

- `src/lib/domain/types.ts:14-83` — `COMPETENCIES`, `MAX_TEAM_SIZE = 6`, `PERKS_PER_CHARACTER = 3`,
  `MAX_PERKS_PER_MEMBER = 2`, typy `PoolCharacter` (z `name`, `description`, `perks: PoolPerk[]`),
  `MemberSelection { characterId, perkIds }`, `TeamComposition = readonly MemberSelection[]`.
- `src/lib/domain/evaluate-team.ts:15-20` — limity składu wracają jako `violations`
  (`too-many-members`, `duplicate-character`, `unknown-character`, …). **Nie ma osobnych helperów
  do budowania składu** — tylko ocena gotowego składu.
- `src/lib/domain/index.ts` — barrel; nowe eksporty domenowe wchodzą tędy.
- `src/lib/character-pool-repo.ts:88-108` — `getCharacterPool(supabase)` zwraca
  `readonly PoolCharacter[]` posortowane po `sort_order` na obu poziomach (kolejność listy w oknie
  wyboru jest gwarantowana z konstrukcji). **Rzuca** `Error` przy błędzie zapytania i przy pustej
  puli. Przegląd F-02 zostawił martwy punkt: „nie sprawdzono, jak S-01 obsłuży stan błędu strony".
- RLS: odczyt puli tylko dla `authenticated`
  (`supabase/migrations/20260905081500_character_pool_schema.sql:40-46`) — strona musi być chroniona,
  inaczej `anon` dostaje pustą pulę i throw.

**Warstwa stron i komponentów jest cienka:**

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`, dopasowanie `startsWith`.
- `src/env.d.ts` — `Astro.locals` ma wyłącznie `user`; klienta Supabase strona tworzy sama przez
  `createClient(Astro.request.headers, Astro.cookies)` i null-checkuje (`src/lib/supabase.ts:5-8`).
- `src/pages/auth/signin.astro:16` — jedyny wzorzec hydratacji: `<SignInForm serverError={error} client:load />`,
  dane wchodzą do wyspy jako serializowalne propsy z frontmattera. Wyspy eksportują `default`,
  komponenty wewnętrzne — nazwane.
- `src/components/ui/button.tsx` — jedyny prymityw shadcn; brak `dialog`. `components.json`:
  styl `new-york`, `baseColor: neutral`, `iconLibrary: lucide`, alias `@/hooks` wskazuje na
  nieistniejący katalog.
- Wygląd to ręczny „cosmic/glass": `bg-cosmic` (`src/styles/global.css:113-115`), karty
  `border-white/10 bg-white/10 backdrop-blur-xl`, akcenty `purple-300/600`, tekst `text-blue-100/60-80`.
  Tokeny shadcn są jasne (`:root`), a `.dark` nigdzie nie jest włączone — `Button` domyślnie
  jest prawie czarny, więc `SubmitButton.tsx:18` nadpisuje go klasami. Dialog będzie wymagał
  tego samego.
- `src/pages/dashboard.astro` — karta powitalna z „Sign out"; `Topbar.astro` używany tylko na
  `index` (`Welcome.astro:2`).

**Testy i lint:**

- `vitest.config.ts` — `include: ["src/**/*.test.ts"]`, środowisko `node`, brak jsdom/Testing
  Library. Testy renderujące React nie są możliwe bez nowych zależności — i nie wchodzą w zakres.
- `eslint.config.js:58` — `react-compiler/react-compiler: "error"`, `react-hooks` 7.1
  (`recommended` zawiera m.in. `set-state-in-effect`), `strictTypeChecked`. `jsx-a11y` obejmuje
  tylko `.astro`. `no-console` to warning.

## Pożądany stan końcowy

Zalogowany gracz wchodzi z dashboardu na `/teams/new`, widzi sześć slotów (0/6), klika „Recruit",
w oknie przegląda dwanaście postaci (lista po lewej, szczegóły po prawej: nazwa, opis,
specjalizacja, trzy perki z nazwanym limitem 2 z 3), dodaje postać — slot się wypełnia, okno się
zamyka. Postać już w drużynie jest w liście oznaczona i nie do dodania. Przy 6/6 wszystkie sloty
są zajęte i nie ma żadnego „Recruit" — okna nie da się otworzyć, licznik pokazuje 6/6. Usunięcie
członka zwalnia slot. Niezalogowany trafia
na `/auth/signin`. Przy niedostępnej puli strona pokazuje kartę błędu zamiast wyspy — nigdy 500.

Weryfikacja: `npm test` dowodzi limitów w `roster.ts` i ich zgodności z `evaluateTeam`;
`npm run lint` i `npm run build` przechodzą; ścieżka ręczna powyżej przechodzi w `npm run dev`.

### Kluczowe odkrycia:

- `readonly PoolCharacter[]` jest wprost przypisywalne do `CharacterPool` (`types.ts:60-71`) —
  moduł składu przyjmuje pulę bez mapowania.
- `evaluateTeam` już nazywa oba limity jako `violations` — moduł składu musi się z nim zgadzać,
  a test tej zgodności jest dowodem, że nie powstało drugie źródło prawdy.
- Radix `Dialog` domyślnie odmontowuje `DialogContent` po zamknięciu — stan „wybrana postać"
  trzymany w komponencie wewnątrz `DialogContent` resetuje się przy każdym otwarciu bez `useEffect`,
  co omija regułę `set-state-in-effect` z react-hooks 7.
- Konwencja z `AGENTS.md`: moduł danych rzuca, strona łapie i mapuje na stan strony.

## Czego NIE robimy

- **Wybór perków** (FR-014) — S-02. W S-01 perki są pokazywane tylko do odczytu w szczegółach
  postaci; `perkIds` każdego członka pozostaje `[]`.
- **Wykres pajęczynowy, werdykt progu, przycisk „Wyrusz na zlecenie"** (FR-016, FR-018) — S-02.
  `evaluateTeam` nie jest wołane z interfejsu w tym fragmencie.
- **Zapis drużyny, tabela `teams`, nazwa-hash** — S-03. Żadnej migracji, żadnej trasy API.
- **Trwałość draftu** (sessionStorage/localStorage) — decyzja: tylko pamięć wyspy.
- **Lista drużyn i strona domowa `/teams`** — S-04. Dashboard zostaje przejściówką z jednym
  przyciskiem.
- **Testy komponentów React** (jsdom, Testing Library) — poza zakresem; strategia testowania
  to Moduł 3.
- **Responsywność / mobile** — Non-Goal PRD; układ dwukolumnowy zakłada szeroki ekran.
- **Przebudowa motywu** — nie włączamy `.dark`, nie ruszamy tokenów shadcn; nowe komponenty
  nadpisują klasy tak jak `SubmitButton`.
- **Filtrowanie/wyszukiwanie w liście postaci** — 12 pozycji nie potrzebuje.

## Podejście do implementacji

Trzy warstwy, każda w swojej fazie, od dołu do góry:

1. **Domena** — `src/lib/domain/roster.ts`: czyste `addMember` / `removeMember`. `addMember`
   zwraca wynik-albo-powód, nigdy nie mutuje i nigdy nie zwraca składu łamiącego limity. Testy
   Vitest dowodzą limitów i zgodności z `violations` z `evaluateTeam`.
2. **Strona** — `src/pages/teams/new.astro` (SSR, chroniona prefiksem `/teams`): tworzy klienta,
   null-checkuje, ładuje pulę w `try/catch`, przekazuje ją jako props do wyspy albo renderuje
   kartę błędu. Wyspa `TeamComposer` trzyma `composition` w `useState` i rysuje sześć slotów.
3. **Okno wyboru** — shadcn `Dialog` (`npx shadcn@latest add dialog`), komponent
   `MemberPickerDialog` z listą i szczegółami, spięty z `addMember`.

Faza 2 jest weryfikowalna bez okna (sloty, ochrona trasy, stan błędu), więc rozdzielenie strony
i dialogu daje dwa niezależne punkty zatrzymania.

## Krytyczne szczegóły implementacji

- **Sekwencjonowanie stanu (dialog):** stan `selectedId` (podgląd w prawej kolumnie) trzymaj
  w komponencie renderowanym **wewnątrz** `DialogContent`, nie w `TeamComposer`. Radix odmontowuje
  zawartość po zamknięciu, więc stan resetuje się sam przy każdym otwarciu; synchronizacja przez
  `useEffect` po `open` złamie `react-hooks/set-state-in-effect`. Domyślny wybór przy otwarciu:
  pierwsza postać spoza drużyny — liczony jako wartość początkowa `useState`, nie w efekcie.
  Zawsze istnieje: okno otwiera wyłącznie pusty slot, więc przy otwartym oknie skład ma ≤ 5
  członków z 12 postaci.
- **Specyfikacja UX:** wyspa wyłącza „Add to team" prewencyjnie (postać w drużynie), ale
  o legalności ruchu decyduje `addMember` — odrzucony wynik zostawia stan bez zmian. Obie warstwy
  mają być zgodne; UI nie może pozwolić na ruch, który moduł odrzuci. Limit członków jest
  nazwany licznikiem `N/6` nad slotami i tym, że przy 6/6 nie ma żadnego „Recruit" — okno nie
  potrzebuje osobnego stanu „pełny skład", bo z pełnego składu nie da się go otworzyć
  (jedyne wejście to pusty slot, a udane dodanie zamyka okno). Odrzucenie `team-full` pozostaje
  w module domenowym jako dowód dla `npm test`, nie jako ekran.
- **Motyw dialogu:** wygenerowany `dialog.tsx` używa `bg-background`/`text-foreground` (jasne
  tokeny). Nie edytuj prymitywu — nadpisz `className` w `DialogContent` z `MemberPickerDialog`
  klasami cosmic (np. `border-white/10 bg-[#0f1529] text-white`), tak jak `SubmitButton`
  nadpisuje `Button`.
- **Logowanie błędu puli:** `no-console` jest warningiem, a w Workerze log to jedyna diagnostyka
  (obserwowalność platformy jest włączona). W `catch` strony użyj `console.error` z komentarzem
  `// eslint-disable-next-line no-console`, a do gracza wyślij komunikat ogólny — treść błędu
  bazy nie trafia do HTML ani do URL.

## Faza 1: Moduł składu w domenie

### Przegląd

Czyste funkcje budujące skład, które egzekwują limity „maksimum sześciu członków" i „brak
powtórzeń" oraz test dowodzący ich zgodności z `evaluateTeam`. Po tej fazie Guardraile FR-012
mają dowód w `npm test`, zanim powstanie jakikolwiek interfejs.

### Wymagane zmiany:

#### 1. Moduł składu

**Plik**: `src/lib/domain/roster.ts` (nowy)

**Cel**: Jedno miejsce, w którym skład rośnie i maleje. Interfejs nie składa `MemberSelection`
sam — woła te funkcje i pokazuje wynik. Moduł jest czysty (bez `astro:*`, bez Supabase, bez
`src/pages/`), jak reszta `src/lib/domain/`.

**Umowa**:

```ts
export type RosterRejection =
  | { kind: "team-full"; limit: number } // limit === MAX_TEAM_SIZE
  | { kind: "already-in-team"; characterId: string }
  | { kind: "unknown-character"; characterId: string };

export type AddMemberResult =
  | { ok: true; composition: TeamComposition }
  | { ok: false; reason: RosterRejection };

/** Dokłada postać z pustym `perkIds`; nie mutuje; kolejność sprawdzeń: pełny skład → duplikat → nieznana postać. */
export function addMember(composition: TeamComposition, characterId: string, pool: CharacterPool): AddMemberResult;

/** Zwraca skład bez wskazanej postaci; gdy jej nie ma — ten sam skład (no-op, ta sama referencja). */
export function removeMember(composition: TeamComposition, characterId: string): TeamComposition;
```

Sygnatura z pulą jako argumentem (nie `CHARACTER_POOL` z importu) — tak jak `evaluateTeam` —
bo wyspa dostaje pulę z bazy, a test podaje własną. Kolejność sprawdzeń jest częścią umowy:
przy pełnym składzie i duplikacie wraca `team-full`.

#### 2. Eksport z barrela

**Plik**: `src/lib/domain/index.ts`

**Cel**: Wyspa i testy importują z `@/lib/domain`, nie z głębokiej ścieżki (konwencja z F-02).

**Umowa**: dopisać `export { addMember, removeMember } from "@/lib/domain/roster"` oraz
`export type { AddMemberResult, RosterRejection }`.

#### 3. Testy modułu składu

**Plik**: `src/lib/domain/roster.test.ts` (nowy)

**Cel**: Dowód limitów niezależny od interfejsu. Progi w asercjach jako literały z PRD (`6`),
nie stałe modułu — lekcja z F-01.

**Umowa**: przypadki, nazwane po własnościach (po polsku, jak w `character-pool-repo.test.ts`):

- dodanie do pustego składu daje jednego członka z `perkIds: []` i nie mutuje wejścia;
- szósty członek wchodzi, siódmy jest odrzucony z `team-full` i `limit: 6`, a skład pozostaje
  ten sam (ta sama referencja);
- ta sama postać drugi raz → `already-in-team`;
- identyfikator spoza puli → `unknown-character`;
- pełny skład + duplikat → `team-full` (kolejność sprawdzeń);
- `removeMember` usuwa wskazaną postać, zachowuje kolejność pozostałych, a dla nieobecnej
  zwraca tę samą referencję;
- **zgodność z `evaluateTeam`**: każdy skład zbudowany wyłącznie przez `addMember` (np. wszystkie
  dwanaście prób dodania po kolei z `CHARACTER_POOL`) ma w `evaluateTeam` zero naruszeń
  `too-many-members` i `duplicate-character`; a skład, który `addMember` odrzucił, doklejony
  „na siłę" (`[...composition, { characterId, perkIds: [] }]`) daje odpowiadające naruszenie
  (`team-full` ↔ `too-many-members`, `already-in-team` ↔ `duplicate-character`).

Pula w testach: `CHARACTER_POOL` z `@/lib/domain` (czysta stała, 12 postaci).

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi, w tym nowy `src/lib/domain/roster.test.ts`
- `npm run lint` przechodzi (po `npx astro sync`)
- `src/lib/domain/` pozostaje czyste: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/` zwraca pusto
- Żaden test nie dotyka Supabase: `grep -rl "lib/supabase" --include='*.test.ts' src` zwraca pusto

#### Ręczna weryfikacja:

- Kontrola mutacyjna: zmiana `MAX_TEAM_SIZE` na 7 wywala test „siódmy członek odrzucony" (drzewo
  przywrócone)

**Uwaga implementacyjna**: po przejściu weryfikacji automatycznej zatrzymaj się na potwierdzenie
użytkownika przed Fazą 2.

---

## Faza 2: Strona `/teams/new` ze stanem błędu i szkieletem składu

### Przegląd

Chroniona strona SSR, która ładuje pulę i hydratuje wyspę `TeamComposer` z sześcioma slotami,
albo pokazuje stan błędu. Po tej fazie ekran istnieje, jest osiągalny z dashboardu, odrzuca
niezalogowanych i nigdy nie zwraca 500 — ale slotów nie da się jeszcze wypełnić (okno przychodzi
w Fazie 3).

### Wymagane zmiany:

#### 1. Ochrona trasy

**Plik**: `src/middleware.ts`

**Cel**: FR-004 dla nowego ekranu i wszystkich przyszłych tras drużyn (S-04, S-05) jednym wpisem.

**Umowa**: `PROTECTED_ROUTES = ["/dashboard", "/teams"]`.

#### 2. Strona kompletowania

**Plik**: `src/pages/teams/new.astro` (nowy)

**Cel**: Wejście do fragmentu (FR-006). Jedyne miejsce, które dotyka Supabase; zamyka martwy
punkt z przeglądu F-02.

**Umowa**: frontmatter tworzy `createClient(Astro.request.headers, Astro.cookies)`; gdy `null`
lub gdy `getCharacterPool` rzuci — ustawia stan błędu (ogólny komunikat „Character pool is
unavailable right now", link powrotu na `/dashboard`) i loguje szczegół przez `console.error`
(patrz Krytyczne szczegóły). W przeciwnym razie renderuje
`<TeamComposer pool={pool} client:load />`. Layout jak `dashboard.astro`: `<Layout title="New team">`,
wrapper `bg-cosmic min-h-screen`, nagłówek gradientowy, link powrotu. Bez `prerender`.

Gałąź `createClient() === null` jest obroną w głąb wymaganą twardą regułą z `AGENTS.md`, ale za
middleware jest **nieosiągalna**: bez kluczy Supabase middleware ustawia `locals.user = null`
i przekierowuje `/teams/*` na `/auth/signin`, zanim frontmatter strony się wykona
(`src/middleware.ts:14-21`). Jedyną realnie osiągalną ścieżką błędu jest throw
z `getCharacterPool` — i to ją weryfikuje krok ręczny poniżej.

#### 3. Wyspa składu

**Plik**: `src/components/team/TeamComposer.tsx` (nowy, eksport `default`)

**Cel**: Trzyma kompletowaną drużynę w pamięci i rysuje ją jako sześć slotów. Jedyny właściciel
stanu `composition` w całym fragmencie.

**Umowa**: props `{ pool: readonly PoolCharacter[] }`. Stan w tej fazie: wyłącznie
`composition: TeamComposition` (`useState`, start `[]`). Renderuje licznik `N/6` (literał z
`MAX_TEAM_SIZE`) i siatkę dokładnie `MAX_TEAM_SIZE` slotów: zajęty slot pokazuje nazwę,
specjalizację i przycisk „Remove" (→ `removeMember`); pusty slot to przycisk „Recruit"
z handlerem `onRecruit`, który w tej fazie jeszcze nic nie robi — **nie** wprowadzaj tu stanu
`pickerOpen`: nieczytany stan wywali `@typescript-eslint/no-unused-vars` w 2.1, a stan
przychodzi razem z oknem w Fazie 3 §3. Nazwę i specjalizację slot bierze z `pool` po
`characterId` (mapa `id → PoolCharacter` policzona z propsa).

#### 4. Slot składu

**Plik**: `src/components/team/RosterSlot.tsx` (nowy, eksport nazwany)

**Cel**: Bezstanowy komponent jednego slotu, sterowany propsami — jak `FormField`.

**Umowa**: `{ member: PoolCharacter | null; onRecruit(): void; onRemove(characterId: string): void }`.
Pusty i zajęty slot wyraźnie różne wizualnie (np. przerywana ramka vs karta glass).

#### 5. Wejścia do ekranu

**Pliki**: `src/pages/dashboard.astro`, `src/components/Topbar.astro`

**Cel**: FR-006 — gracz musi mieć skąd rozpocząć kompletowanie.

**Umowa**: dashboard dostaje przycisk/link „Assemble a new team" → `/teams/new` nad „Sign out";
Topbar (wariant zalogowany) dostaje link „New team" obok „Dashboard".

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx astro sync && npm run lint` przechodzi (react-compiler, react-hooks 7, strictTypeChecked)
- `npm test` nadal przechodzi
- `npm run build` przechodzi

#### Ręczna weryfikacja:

- `npm run dev`, niezalogowany: `/teams/new` przekierowuje na `/auth/signin`
- Zalogowany: `/teams/new` pokazuje licznik `0/6` i sześć pustych slotów „Recruit"; link
  z dashboardu i z Topbara prowadzą na stronę
- Stan błędu: z poprawnym `.env` tymczasowo zepsuć zapytanie w `src/lib/character-pool-repo.ts`
  (`.from("characters")` → `.from("characters_x")`); zalogowany na `/teams/new` widzi kartę
  „Character pool is unavailable" zamiast wyspy, bez 500, a w konsoli serwera jest
  `console.error`; plik przywrócony (`git checkout src/lib/character-pool-repo.ts`). Uwaga:
  usunięcie kluczy z `.env` **nie** testuje tej ścieżki — middleware przekieruje na logowanie

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie użytkownika przed Fazą 3.

---

## Faza 3: Okno wyboru członka

### Przegląd

Prymityw `Dialog` z shadcn i komponent `MemberPickerDialog` — lista po lewej, szczegóły po
prawej, „Add to team" spięte z `addMember`. Po tej fazie S-01 jest kompletny: cała ścieżka
z „Pożądanego stanu końcowego" działa.

### Wymagane zmiany:

#### 1. Prymityw dialogu

**Plik**: `src/components/ui/dialog.tsx` (generowany), `package.json`

**Cel**: Dostępne okno modalne (focus trap, Esc, klik w tło) bez pisania go ręcznie; S-06
użyje tego samego prymitywu do potwierdzenia usunięcia.

**Umowa**: `npx shadcn@latest add dialog` — dokłada `@radix-ui/react-dialog` do `dependencies`
i plik prymitywu (mała litera, styl new-york). Nie edytować wygenerowanego pliku poza tym, co
wymusi `npm run lint:fix` (prettier). Sprawdzić `git diff` — CLI nie może dotknąć `global.css`
ani `components.json` w sposób inny niż kosmetyczny.

#### 2. Okno wyboru członka

**Plik**: `src/components/team/MemberPickerDialog.tsx` (nowy, eksport nazwany)

**Cel**: FR-013 — lista dostępnych postaci w lewej kolumnie, szczegóły wybranej w prawej;
FR-012 — postać w drużynie widoczna, oznaczona, nie do dodania.

**Umowa**: props
`{ open: boolean; onOpenChange(open: boolean): void; pool: readonly PoolCharacter[]; memberIds: ReadonlySet<string>; onAdd(characterId: string): void }`.
`DialogContent` z nadpisanym `className` (motyw cosmic, szerokość ok. `max-w-3xl`, siatka dwóch
kolumn). W `DialogHeader`: `DialogTitle` „Recruit a member" i `DialogDescription` (np. „Pick
a character to add to your team") — Radix loguje `console.error` i traci etykietę dla czytników,
gdy `DialogContent` nie ma tytułu, a ostrzega przy braku opisu (alternatywa dla opisu:
`aria-describedby={undefined}` na `DialogContent`). Zawartość to komponent wewnętrzny (np.
`MemberPickerBody`) trzymający `selectedId`
z wartością początkową „pierwsza postać spoza `memberIds`" — patrz Krytyczne szczegóły. Lewa kolumna: przyciski-wiersze z nazwą i specjalizacją, wiersz w drużynie
ma etykietę „In team" i styl wyciszony, ale pozostaje klikalny do podglądu. Prawa kolumna:
nazwa, opis, specjalizacja (z podpisem „+2 points" wolno pominąć — S-02), lista trzech perków
z nazwą i kompetencją pod nagłówkiem nazywającym limit („Perks — up to 2 of 3 can be chosen";
wybór przychodzi w S-02) oraz przycisk „Add to team" wyłączony, gdy postać jest w `memberIds`.

#### 3. Spięcie z wyspą

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Domknięcie pętli dodaj/usuń.

**Umowa**: dopiero tu wchodzi stan `pickerOpen: boolean` (`useState`, start `false`) —
„Recruit" ustawia `true`, `onOpenChange` okna go zmienia, udane dodanie ustawia `false`.
`onAdd(id)` → `const result = addMember(composition, id, pool)`; przy `ok`
ustawia skład i zamyka okno; przy odrzuceniu zostawia stan bez zmian (UI i tak nie pozwala na
ten ruch). `memberIds` liczone z `composition`.

#### 4. Domknięcie wpisu w roadmapie

**Plik**: `context/foundation/roadmap.md`

**Cel**: Niewiadoma S-01 („czy drużyna przeżywa odświeżenie") jest rozstrzygnięta — wpis ma to
odnotować, jak przy F-02.

**Umowa**: w bloku `### S-01` przepisać punkt Niewiadomych na „**Rozstrzygnięte (2026-09-05,
sesja planowania):** tylko pamięć wyspy, bez trwałości". Status elementu zmienia
`/10x-implement` / `/10x-archive`, nie ta edycja.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx astro sync && npm run lint` przechodzi (w tym wygenerowany `dialog.tsx`)
- `npm test` przechodzi
- `npm run build` przechodzi
- `@radix-ui/react-dialog` jest w `dependencies` w `package.json`

#### Ręczna weryfikacja:

- „Recruit" otwiera okno z dwunastoma postaciami w kolejności puli; klik w wiersz zmienia
  szczegóły po prawej; Esc i klik w tło zamykają okno
- „Add to team" dodaje postać, okno się zamyka, slot pokazuje nazwę i specjalizację, licznik rośnie
- Postać w drużynie ma w liście etykietę „In team", jej „Add to team" jest wyłączony
- Przy 6/6 licznik pokazuje `6/6`, nie ma żadnego pustego slotu ani przycisku „Recruit" — okna
  nie da się otworzyć, więc nikogo nie da się dodać
- „Remove" zwalnia slot, licznik maleje, postać wraca do wyboru w oknie
- Odświeżenie strony zeruje skład (decyzja: brak trwałości)
- Szczegóły pokazują trzy perki z kompetencjami i nagłówek nazywający limit 2 z 3

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/domain/roster.test.ts` — limity, kolejność sprawdzeń, niemutowalność, no-op usuwania,
  zgodność z `violations` z `evaluateTeam` (lista przypadków w Fazie 1).

### Testy integracyjne:

- Brak — z konstrukcji (twarde reguły: testy czyste). Podłączenie modułu do wyspy, ochrona trasy
  i stan błędu są weryfikowane ręcznie.

### Kroki testowania ręcznego:

1. Wylogowany → `/teams/new` → przekierowanie na logowanie.
2. Zalogowany → dashboard → „Assemble a new team" → `0/6`, sześć slotów.
3. Dodaj sześć różnych postaci przez okno; sprawdź „In team", `6/6` i brak „Recruit".
4. Usuń jednego członka; dodaj tę samą postać ponownie.
5. Odśwież stronę — `0/6`.
6. Tymczasowo zepsuj zapytanie w `character-pool-repo.ts` (`.from("characters_x")`) → karta
   błędu, brak 500, `console.error` w konsoli serwera; przywróć plik.

## Uwagi dotyczące wydajności

Bez wymagań: stan to tablica ≤ 6 elementów i pula 12 postaci, wszystko w pamięci. Wymóg NFR
„< 200 ms" dotyczy przeliczania wykresu w S-02. Nie memoizuj na zapas — react-compiler i tak
to robi.

## Uwagi dotyczące migracji

Brak migracji i zmian schematu. Jedyna zmiana zależności: `@radix-ui/react-dialog` (Faza 3).
Przed Fazą 2 warto potwierdzić, że migracja
`20260905090700_character_pool_revoke_writes.sql` została wypchnięta na projekt hostowany
(`supabase db push`, punkt F6 z przeglądu F-02) — nie blokuje S-01, ale to ostatnia chwila,
zanim pojawi się interfejs czytający pulę z produkcji.

## Referencje

- Roadmapa: `context/foundation/roadmap.md` → `### S-01`
- Poprzednik: `context/archive/2026-08-30-solvable-character-pool/plan.md`,
  `.../reviews/impl-review.md` (martwy punkt F2 → obsługa błędu strony)
- Reguła domenowa: `src/lib/domain/evaluate-team.ts:15-40`
- Wzorzec wyspy: `src/pages/auth/signin.astro:16`, `src/components/auth/SignInForm.tsx`
- Nadpisywanie motywu prymitywu: `src/components/auth/SubmitButton.tsx:18`
- Wzorzec null-checku klienta: `src/middleware.ts:7-16`, `src/pages/api/auth/signin.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Moduł składu w domenie

#### Automatyczne

- [ ] 1.1 `npm test` przechodzi, w tym `src/lib/domain/roster.test.ts`
- [ ] 1.2 `npm run lint` przechodzi
- [ ] 1.3 `src/lib/domain/` bez importów `astro:*` / `@/lib/supabase`
- [ ] 1.4 Żaden test nie importuje `lib/supabase`

#### Ręczne

- [ ] 1.5 Kontrola mutacyjna `MAX_TEAM_SIZE` → 7 wywala test (drzewo przywrócone)

### Faza 2: Strona `/teams/new` ze stanem błędu i szkieletem składu

#### Automatyczne

- [ ] 2.1 `npx astro sync && npm run lint` przechodzi
- [ ] 2.2 `npm test` przechodzi
- [ ] 2.3 `npm run build` przechodzi

#### Ręczne

- [ ] 2.4 Niezalogowany na `/teams/new` → przekierowanie na `/auth/signin`
- [ ] 2.5 Zalogowany widzi `0/6` i sześć slotów; linki z dashboardu i Topbara działają
- [ ] 2.6 Przy zepsutym zapytaniu puli strona pokazuje kartę błędu, bez 500 (plik repo przywrócony)

### Faza 3: Okno wyboru członka

#### Automatyczne

- [ ] 3.1 `npx astro sync && npm run lint` przechodzi z wygenerowanym `dialog.tsx`
- [ ] 3.2 `npm test` przechodzi
- [ ] 3.3 `npm run build` przechodzi
- [ ] 3.4 `@radix-ui/react-dialog` w `dependencies`

#### Ręczne

- [ ] 3.5 Okno: dwanaście postaci w kolejności puli, podgląd szczegółów, Esc/klik w tło zamyka
- [ ] 3.6 „Add to team" wypełnia slot, zamyka okno, licznik rośnie
- [ ] 3.7 Postać w drużynie oznaczona „In team" i nie do dodania
- [ ] 3.8 Przy 6/6 licznik `6/6`, brak „Recruit" i brak możliwości dodania
- [ ] 3.9 „Remove" zwalnia slot, postać wraca do wyboru
- [ ] 3.10 Odświeżenie strony zeruje skład
- [ ] 3.11 Szczegóły pokazują trzy perki i nagłówek nazywający limit 2 z 3
