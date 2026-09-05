# Plan implementacji: Wybór perków, wykres pajęczynowy i blokada progu (S-02)

## Przegląd

Fragment, który czyni regułę domenową widoczną. Na istniejącej stronie `/teams/new` gracz
wybiera maksymalnie dwa z trzech perków każdego członka na karcie jego slotu, widzi wykres
pajęczynowy siedmiu kompetencji przeliczany po każdej zmianie składu lub perków oraz przycisk
„Embark on the job" (odpowiednik „Wyrusz na zlecenie" z PRD), który pozostaje zablokowany
z komunikatem ogólnym, dopóki którakolwiek kompetencja ma mniej niż dwa punkty — i blokuje się
z powrotem, gdy próg przestaje być spełniony (FR-014, FR-016, FR-018, FR-015).

Bez zapisu, tabeli `teams` i trasy API (S-03), bez licznika brakujących punktów (S-08). Skład
nadal żyje wyłącznie w pamięci wyspy (rozstrzygnięcie S-01). Zero nowych zależności: wykres to
ręczny inline SVG — to rozstrzyga jedyną niewiadomą S-02 z roadmapy.

## Analiza stanu obecnego

**Domena jest prawie gotowa (F-01, F-02, S-01):**

- `src/lib/domain/evaluate-team.ts:54` — `evaluateTeam(composition, pool)` zwraca `scores`,
  `missing`, `violations`, `isValid`. **Nikt poza testami tego nie woła** — S-02 jest pierwszym
  konsumentem produkcyjnym. `isValid` jest bezpieczne samo w sobie (naruszenie limitu zawsze je
  zeruje), więc bramka przycisku wiąże się z nim wprost.
- `src/lib/domain/evaluate-team.ts:23-32` — **umowa z F-01**: `scores` liczą surowy wybór gracza,
  także odrzucony przez limity (trzeci perk dolicza punkt mimo `too-many-perks`). Komentarz
  nakazuje konsumentowi wykresu czytać sumy wyłącznie przy pustym `violations` (Guardrail „wykres
  zawsze zgodny ze składem").
- `src/lib/domain/roster.ts:30-44` — `addMember` dokłada `perkIds: []` z komentarzem „wybór perków
  przychodzi w S-02". **Nie ma pisarza perków**: limit 2/3 (`MAX_PERKS_PER_MEMBER`,
  `types.ts:33`) jest dziś egzekwowany tylko po fakcie jako naruszenie `too-many-perks`.
  `removeMember` zwraca tę samą referencję przy no-op (`roster.ts:51-53`) — wzorzec dla `useState`.
- `src/lib/domain/roster.test.ts:117-178` — blok „zgodność z `evaluateTeam`": każde odrzucenie
  z `roster.ts` ma odpowiadające naruszenie po doklejeniu na siłę. Szablon dla testów perków.
- `src/lib/domain/solvability.ts:129` — `findThresholdSolution(pool)` (tylko testy, poza barrelem)
  zwraca skład domykający próg; `character-pool.test.ts:77` dowodzi, że dla `CHARACTER_POOL`
  nie jest `null`.
- Stan `MemberSelection.perkIds` już istnieje w `useState<TeamComposition>` wyspy
  (`TeamComposer.tsx:21`) — zawsze `[]`, bo `addMember` jest jedynym pisarzem. Kształt stanu się
  nie zmienia; brakuje pisarza.

**Interfejs S-01:**

- `src/components/team/TeamComposer.tsx` — jedyny właściciel `composition`; `slots` mapuje indeks
  na `PoolCharacter | null` (`:44-47`), gubiąc `MemberSelection` — karta slotu nie widzi perków.
  Sloty w siatce `grid-cols-3`, strona w `max-w-4xl` (`new.astro:29`).
- `src/components/team/RosterSlot.tsx` — bezstanowy; zajęty slot pokazuje nazwę, specjalizację
  i „Remove". Bez perków.
- `src/components/team/MemberPickerDialog.tsx:104-117` — perki renderowane **tylko do odczytu**
  pod nagłówkiem „Perks — up to 2 of 3 can be chosen"; podpis „+2 points" przy specjalizacji plan
  S-01 wprost odłożył do S-02 (`plan.md:372-374`).
- `src/components/ui/button.tsx:8` — bazowe klasy mają `disabled:pointer-events-none
  disabled:opacity-50`: stan zablokowany jest za darmo, ale tooltip na zablokowanym przycisku nie
  zadziała. Wariantów jest sześć, żaden nie pasuje do motywu cosmic — stąd kopie ciągu
  `bg-purple-600 … hover:bg-purple-500` w `SubmitButton.tsx:18`, `MemberPickerDialog.tsx:125`,
  `dashboard.astro:19` i `Welcome.astro:43` (dług F6 z przeglądu S-01 liczył trzy kopie;
  czwarta siedzi na publicznej stronie `/` — `index.astro` renderuje `Welcome.astro`).
- Motyw: ręczny „cosmic" (`bg-cosmic`, `border-white/10`, `text-blue-100/70`, `purple-300/600`);
  jasne tokeny shadcn nieużywane, `.dark` nigdy nie włączone, tokeny `--chart-1..5` — pięć na
  siedem osi i w jasnej palecie. Wykres musi używać palety cosmic wprost.
- Zero bibliotek wykresów i zero reużywalnego SVG w repo (jedyny SVG to trzy dekoracyjne ikony
  w `Welcome.astro`).

**Testy i lint:** `vitest run` nad `src/**/*.test.ts`, środowisko `node`, bez jsdom — testy
komponentów React poza zasięgiem (i poza zakresem). `react-compiler/react-compiler: "error"`,
`react-hooks` 7 (`set-state-in-effect`), `strictTypeChecked`.

## Pożądany stan końcowy

Zalogowany gracz na `/teams/new` widzi dwie kolumny: po lewej sloty składu, po prawej wykres
pajęczynowy siedmiu kompetencji z pierścieniem progu i pod nim przycisk „Embark on the job"
z tekstem „Every competency needs at least 2 points before the team can embark." Po każdym
dodaniu/usunięciu członka i każdym przełączeniu perka wielokąt na wykresie zmienia się od razu.
Na karcie zajętego slotu są trzy perki jako przełączniki z licznikiem `N/2`; przy 2/2 niewybrany
perk jest wyłączony, odznaczenie go odblokowuje. Gdy wszystkie siedem osi sięga pierścienia
progu, przycisk się odblokowuje (bez akcji — zapis to S-03); zdjęcie perka lub członka, które
cofa próg, blokuje go z powrotem. Okno wyboru członka pokazuje perki nadal do odczytu, z podpisem
„+2 points" przy specjalizacji i wskazówką, że perki wybiera się na karcie po rekrutacji.

Weryfikacja: `npm test` dowodzi limitu perków w `roster.ts`, jego zgodności z `evaluateTeam`
i tego, że geometria wykresu jest wiernym rzutem sum (skala nigdy nie obcina); `npm run lint`
i `npm run build` przechodzą; ścieżka ręczna z przepisem na skład domykający próg przechodzi
w `npm run dev`.

### Kluczowe odkrycia:

- `readonly PoolCharacter[]` wchodzi do `evaluateTeam` bez rzutowania (`types.ts:60-66`) —
  wyspa woła `evaluateTeam(composition, pool)` na propsie, który już ma.
- Skład budowany wyłącznie funkcjami z `roster.ts` nigdy nie ma naruszeń — po dodaniu
  `togglePerk` z limitem ten niezmiennik obejmie też `too-many-perks` i `unknown-perk`, więc
  warunek „czytaj `scores` tylko przy pustym `violations`" jest spełniony **z konstrukcji**,
  a test zgodności jest tego dowodem.
- Przepis na skład domykający próg z `CHARACTER_POOL` (do weryfikacji ręcznej): Vesper Kane
  (combat), Dolores „Torque" Amani (engineering), Sable Nine (stealth), Cassius Wren
  (negotiation), Dr. Imani Oyelaran (medicine), Ren „Ghostline" Takahashi (hacking) → brakuje
  2 pkt `navigation`; perki „Extraction Routes" (Vesper) + „Service Tunnel Access" (Torque)
  domykają próg. W testach nie wpisywać tych identyfikatorów na sztywno — użyć
  `findThresholdSolution(CHARACTER_POOL)` (uwaga F3 z przeglądu S-01).
- Koszt przeliczenia: siedem liczników nad ≤ 6 członkami i ≤ 12 perkami — budżet 200 ms jest
  pomijalny; poprzednie plany zakazują memoizacji na zapas (react-compiler robi to sam).

## Czego NIE robimy

- **Zapis drużyny, tabela `teams`, nazwa-hash, trasa `/api/teams`, komunikat „Work in Progress"**
  — S-03. Odblokowany przycisk w S-02 **nie ma handlera** (decyzja użytkownika): S-02 dostarcza
  wyłącznie bramkę. Nie przesądzamy kształtu zapisu (formularz vs `fetch`).
- **Lista brakujących punktów** (FR-017) — S-08. `evaluation.missing` jest liczone, ale nie
  renderowane; komunikat pod przyciskiem jest **ogólny**, bez wyliczania luk (rozstrzygnięcie
  FR-018).
- **Wybór perków w oknie wyboru członka** — okno zostaje do odczytu; jedyną powierzchnią wyboru
  jest karta slotu (decyzja użytkownika).
- **Automatyczna zamiana perka przy 2/2** — trzeci perk jest wyłączony; zamiana to dwa kliknięcia.
- **Biblioteka wykresów** (Recharts, shadcn `chart`), animacje i tooltipy na wykresie — Non-Goal
  tego fragmentu; ręczny SVG bez interakcji.
- **Nowe tokeny `--chart-*`, włączanie `.dark`, przebudowa motywu** — wykres używa palety cosmic
  literałami klas, jak reszta ekranów drużyn.
- **Testy komponentów React** (jsdom, Testing Library) — strategia testowania to Moduł 3.
- **Trwałość składu** — odświeżenie nadal zeruje skład (S-01).
- **Responsywność / mobile** — układ dwukolumnowy zakłada szeroki ekran (Non-Goal PRD).
- **Zmiana `dashboard.astro:19` i `Welcome.astro:43`** — to `<a>`, nie `Button`; wariant
  `cosmic` dotyczy tylko komponentów React. Te dwie kopie zostają świadomie.

## Podejście do implementacji

Trzy warstwy w tej samej kolejności co w S-01, od dołu do góry:

1. **Domena** — `togglePerk` w `src/lib/domain/roster.ts`: czysty pisarz perków, który egzekwuje
   limit 2/3 i przynależność perka do postaci, zwraca wynik-albo-powód i nigdy nie zwraca składu
   łamiącego limity. Testy dowodzą limitu i zgodności z `violations` z `evaluateTeam`. Po tej
   fazie FR-014 ma dowód w `npm test`, zanim powstanie interfejs.
2. **Wykres i bramka** — czysty helper geometrii `src/lib/radar-geometry.ts` (bez wiedzy
   o domenie: klucze i wartości jako parametry) z testami; komponent `CompetencyRadar` rysujący
   jego wynik jako SVG; wariant `cosmic` w `buttonVariants`; komponent `EmbarkGate`; wyspa woła
   `evaluateTeam` i przechodzi na układ dwukolumnowy. Faza jest weryfikowalna bez perków: sześć
   postaci bez perków daje sześć osi na 2 i jedną na 0, przycisk zablokowany.
3. **Perki na karcie slotu** — `RosterSlot` dostaje `MemberSelection` i trzy przełączniki spięte
   z `togglePerk`; podpisy w oknie wyboru; domknięcie niewiadomej w roadmapie. Dopiero tu próg da
   się domknąć i bramka otwiera się oraz zamyka w obie strony.

## Krytyczne szczegóły implementacji

- **Umowa `scores` / `violations`:** wyspa czyta `evaluation.scores` do wykresu tylko przy pustym
  `evaluation.violations` (`evaluate-team.ts:23-32`). Z konstrukcji `roster.ts` naruszenia są
  nieosiągalne, ale gałąź obronna w wyspie jest jednolinijkowa — renderuj krótki komunikat
  zamiast wykresu i zostaw komentarz wskazujący na tę umowę. `isValid` do bramki czytaj zawsze.
- **Skala wykresu nigdy nie obcina:** maksimum osi to `max(2 × próg, najwyższa suma)` — domyślnie
  4, więc pierścień progu (2) leży w połowie promienia; gdy suma przekroczy 4 (dwie postacie
  o tej samej specjalizacji plus perki), skala rośnie zamiast ucinać wielokąt. Obcięcie łamałoby
  Guardrail „wykres zawsze zgodny ze składem". Przy każdej osi jest też liczba, więc wartość jest
  odczytywalna niezależnie od geometrii.
- **Specyfikacja UX bramki:** `Button` ma `disabled:pointer-events-none`, więc komunikat ogólny
  jest **statycznym tekstem** pod przyciskiem, nie tooltipem; przycisk wskazuje go przez
  `aria-describedby`. Tekst zmienia się przy odblokowaniu („All seven competencies are covered."),
  żeby przejście było widoczne także bez koloru.
- **Sekwencjonowanie stanu (przełącznik perka):** użyj funkcyjnego `setComposition((current) =>
  …)` i przy odrzuceniu zwróć `current` (ta sama referencja — brak re-renderu), jak
  `handleRemove`. Nie trzymaj w wyspie żadnego stanu pochodnego (`evaluation`, licznik perków) —
  liczone przy renderze; efekt synchronizujący złamałby `set-state-in-effect`.
- **Kolejność w `perkIds`** jest kolejnością wyboru (append), nie kolejnością w puli. Interfejs
  nie polega na niej (przełączniki renderowane z `character.perks`), a S-03 zapisze ją jak jest.

## Faza 1: Pisarz perków w domenie

### Przegląd

Czysta funkcja `togglePerk`, która egzekwuje limit „maksimum dwa perki na członka" i „perk musi
należeć do tej postaci", oraz testy dowodzące jej zgodności z `evaluateTeam`. Po tej fazie
Guardrail „maksymalnie 2 perki na członka" ma dowód w `npm test`.

### Wymagane zmiany:

#### 1. Przełącznik perka

**Plik**: `src/lib/domain/roster.ts`

**Cel**: Drugi (i ostatni) pisarz składu obok `addMember`/`removeMember` — interfejs nie składa
`perkIds` sam. Moduł pozostaje czysty (bez `astro:*`, Supabase, `src/pages/`).

**Umowa**:

```ts
export type PerkRejection =
  | { kind: "member-not-in-team"; characterId: string }
  | { kind: "unknown-perk"; characterId: string; perkId: string }
  | { kind: "perk-limit"; characterId: string; limit: number }; // limit === MAX_PERKS_PER_MEMBER

export type TogglePerkResult = { ok: true; composition: TeamComposition } | { ok: false; reason: PerkRejection };

/**
 * Zaznacza perk, jeśli nie jest wybrany, albo odznacza, jeśli jest. Nie mutuje.
 * Kolejność sprawdzeń: członek w składzie → perk należy do tej postaci w puli → (odznaczenie
 * zawsze wchodzi) → limit. Nowy perk trafia na koniec `perkIds`; pozostali członkowie
 * zachowują referencje.
 */
export function togglePerk(
  composition: TeamComposition,
  characterId: string,
  perkId: string,
  pool: CharacterPool,
): TogglePerkResult;
```

Perk sprawdzany jest w `character.perks` postaci z puli — perk innej postaci lub nieistniejący
to `unknown-perk` (odpowiednik naruszenia `unknown-perk` z `evaluateTeam`). Członek składu,
którego `characterId` nie ma w puli (możliwe tylko w składzie doklejonym na siłę), również daje
`unknown-perk` — pula nie zna żadnego jego perka; bez nowego wariantu odrzucenia. Odznaczanie
sprawdza się **przed** limitem, żeby członek z 2/2 mógł zdjąć perk. Zaktualizuj komentarz przy
`addMember` („wybór perków przychodzi w S-02" → wskazanie na `togglePerk`).

#### 2. Eksport z barrela

**Plik**: `src/lib/domain/index.ts`

**Cel**: Wyspa i testy importują z `@/lib/domain`.

**Umowa**: dopisać `togglePerk` do eksportu z `@/lib/domain/roster` oraz typy `PerkRejection`,
`TogglePerkResult`.

#### 3. Testy przełącznika

**Plik**: `src/lib/domain/roster.test.ts`

**Cel**: Dowód limitu niezależny od interfejsu. Progi w asercjach jako literały z PRD (`2`), nie
stała `MAX_PERKS_PER_MEMBER` (lekcja z F-01). Identyfikatory z `POOL_IDS` / `CHARACTER_POOL`,
nie literały (uwaga F3 z przeglądu S-01).

**Umowa**: nowy `describe("togglePerk")` i rozszerzenie bloku zgodności:

- zaznaczenie dokłada perk do właściwego członka, pozostali członkowie są nietknięci (te same
  referencje), wejście nie jest mutowane;
- ponowne przełączenie tego samego perka odznacza go;
- drugi perk wchodzi, trzeci jest odrzucony z `perk-limit` i `limit: 2`, a skład pozostaje ten sam;
- po odznaczeniu jednego z dwóch trzeci może wejść;
- perk innej postaci z puli → `unknown-perk`; nieistniejący identyfikator → `unknown-perk`;
  członek doklejony na siłę z `characterId` spoza puli → `unknown-perk`;
- postać spoza składu → `member-not-in-team` (także gdy jest w puli);
- kolejność `perkIds` jest kolejnością wyboru;
- **zgodność z `evaluateTeam`**: skład zbudowany wyłącznie przez `addMember` + `togglePerk`
  (np. każdemu z sześciu członków próba zaznaczenia wszystkich trzech perków po kolei) ma zero
  naruszeń jakiegokolwiek rodzaju, a `scores` równa się 2 × liczba specjalizacji + 1 × liczba
  wybranych perków per kompetencja; odrzucenie `perk-limit` doklejone na siłę daje
  `too-many-perks`, odrzucenie `unknown-perk` doklejone na siłę daje `unknown-perk`;
- **próg osiągalny przez pisarzy**: skład z `findThresholdSolution(CHARACTER_POOL)` (import
  z `@/lib/domain/solvability`, jak w `character-pool.test.ts`) odtworzony wyłącznie przez
  `addMember` i `togglePerk` daje `isValid: true` — dowód, że interfejs oparty na tych dwóch
  funkcjach jest w stanie domknąć próg.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi, w tym rozszerzony `src/lib/domain/roster.test.ts`
- `npx astro sync && npm run lint` przechodzi
- `src/lib/domain/` pozostaje czyste: `grep -rE "from ['\"](astro:|@/lib/supabase)" src/lib/domain/` zwraca pusto

#### Ręczna weryfikacja:

- Kontrola mutacyjna: zmiana `MAX_PERKS_PER_MEMBER` na 3 wywala test „trzeci perk odrzucony"
  (drzewo przywrócone)

**Uwaga implementacyjna**: po przejściu weryfikacji automatycznej zatrzymaj się na potwierdzenie
użytkownika przed Fazą 2.

---

## Faza 2: Wykres pajęczynowy i bramka

### Przegląd

Wyspa woła `evaluateTeam`, rysuje wykres z czystego helpera geometrii i pokazuje zablokowany
przycisk z komunikatem ogólnym. Po tej fazie reguła domenowa jest widoczna na ekranie, choć próg
jest jeszcze nieosiągalny (perki przychodzą w Fazie 3): sześć postaci daje sześć osi na 2 i jedną
na 0.

### Wymagane zmiany:

#### 1. Geometria wykresu

**Plik**: `src/lib/radar-geometry.ts` (nowy)

**Cel**: Cała matematyka wykresu w czystym module testowalnym bez jsdom — SVG jest tylko rzutem
przetestowanych liczb (Guardrail „wykres zawsze zgodny ze składem"). Moduł nie zna domeny:
klucze osi i wartości są parametrami, więc mieszka w `src/lib/` obok `utils.ts`, nie
w `src/lib/domain/`.

**Umowa**:

```ts
export interface RadarPoint { x: number; y: number }
export interface RadarAxis<K extends string> {
  key: K;
  end: RadarPoint;
  label: RadarPoint;
  /** `text-anchor` etykiety: `middle` dla osi pionowych (|cos| < ε), `start` po prawej, `end` po lewej. */
  anchor: "start" | "middle" | "end";
}
export interface RadarLayout<K extends string> {
  size: number;
  center: RadarPoint;
  radius: number;
  /** Wartość na końcu osi: max(2 × threshold, najwyższa wartość) — nigdy nie obcina. */
  max: number;
  axes: readonly RadarAxis<K>[];
  thresholdRing: readonly RadarPoint[];
  polygon: readonly RadarPoint[];
}

export function radarScaleMax(values: readonly number[], threshold: number): number;

/** Pierwsza oś wskazuje w górę (−90°), kolejne zgodnie z ruchem wskazówek zegara, równo co 360°/n. */
export function radarLayout<K extends string>(
  keys: readonly K[],
  values: Readonly<Record<K, number>>,
  options: { size: number; threshold: number; labelMargin?: number; labelOffset?: number },
): RadarLayout<K>;
```

`radius = size / 2 − labelMargin` (domyślnie `labelMargin` = 56, `labelOffset` = 12 — margines
musi pomieścić najdłuższą etykietę „negotiation N" w `text-xs`); `label` leży na przedłużeniu
osi o `labelOffset` za jej końcem, a `anchor` wynika ze znaku cosinusa kąta osi, żeby tekst rósł
na zewnątrz wykresu, nie na wielokąt. Każdy punkt `label` leży w `[0, size]` — etykieta nigdy nie
wychodzi poza `viewBox`. Punkt wartości `v` na osi leży w odległości `radius × v / max` od środka.

#### 2. Testy geometrii

**Plik**: `src/lib/radar-geometry.test.ts` (nowy)

**Cel**: Dowód, że wielokąt jest wiernym rzutem wartości.

**Umowa**: przypadki (asercje `toBeCloseTo`, klucze testowe własne — np. siedem liter — nie
`COMPETENCIES`):

- `n` kluczy daje `n` osi w kolejności kluczy; pierwsza kończy się dokładnie nad środkiem
  (`x = cx`, `y = cy − radius`); każdy koniec osi jest w odległości `radius` od środka; kąt
  między kolejnymi osiami to `2π / n`;
- wartość 0 daje wierzchołek w środku; wartość `max` — na końcu osi; wartość równa progowi —
  na pierścieniu progu (ta sama odległość od środka co odpowiedni punkt `thresholdRing`);
- `radarScaleMax`: dla wartości ≤ 2 × próg zwraca 2 × próg (dla progu 2 → 4); gdy jakaś wartość
  przekracza, zwraca ją — wielokąt nigdy nie wychodzi poza koniec osi ani nie jest obcinany;
- `polygon` ma po jednym punkcie na klucz w kolejności kluczy; wejściowe `values` nie są mutowane;
- etykiety: każdy `label` leży w `[0, size]` na obu osiach (także dla `n = 7` i domyślnych
  marginesów); oś w górę ma `anchor: "middle"`, osie po prawej stronie środka `"start"`, po lewej
  `"end"` (dla `n = 4`: góra `middle`, prawo `start`, dół `middle`, lewo `end`).

#### 3. Komponent wykresu

**Plik**: `src/components/team/CompetencyRadar.tsx` (nowy, eksport nazwany)

**Cel**: FR-016 — siedem kompetencji jako wykres pajęczynowy z widocznym progiem.

**Umowa**: props `{ scores: Readonly<Record<Competency, number>>; threshold: number }`. Woła
`radarLayout(COMPETENCIES, scores, { size: 320, threshold })`. Inline `<svg viewBox>` z
`role="img"` i `aria-label` wymieniającym siedem sum (np. „combat 2, hacking 0, …"); osie jako
linie `stroke-white/15`; pierścień progu jako przerywany wielokąt `stroke-purple-300/70`
z podpisem „threshold 2" (literał z `threshold`); wielokąt sum `fill-purple-500/30
stroke-purple-300` z kropkami na wierzchołkach; etykiety osi `<text>` z nazwą kompetencji
i sumą, `textAnchor={axis.anchor}` (pozycja i kotwica przychodzą z helpera — komponent nie liczy
nic sam), w kolorze zależnym od progu (np. `fill-emerald-300` przy sumie ≥ próg,
`fill-blue-100/60` poniżej). Paleta cosmic literałami klas Tailwind (`fill-*`/`stroke-*`),
nie tokeny `--chart-*`. Bez animacji, bez tooltipów, bez stanu.

#### 4. Wariant `cosmic` przycisku

**Plik**: `src/components/ui/button.tsx`, `src/components/auth/SubmitButton.tsx`,
`src/components/team/MemberPickerDialog.tsx`

**Cel**: Dług F6 z przeglądu S-01 — czwarta kopia ciągu klas CTA nie powstaje; istniejące dwie
kopie w komponentach React przechodzą na wariant.

**Umowa**: w `buttonVariants.variants.variant` nowy klucz
`cosmic: "rounded-lg bg-purple-600 text-white hover:bg-purple-500"`; `SubmitButton.tsx:18`
i `MemberPickerDialog.tsx:125` używają `variant="cosmic"` i zachowują tylko klasy układu
(`w-full`, `mt-6`). `defaultVariants` bez zmian. `dashboard.astro` i `Welcome.astro` nietknięte
(to `<a>`).

#### 5. Bramka „Embark on the job"

**Plik**: `src/components/team/EmbarkGate.tsx` (nowy, eksport nazwany)

**Cel**: FR-018 — przycisk zablokowany z komunikatem ogólnym, dopóki `isValid` jest fałszywe.
W S-02 bez akcji (decyzja: sama bramka); S-03 dołoży handler/formularz.

**Umowa**: props `{ ready: boolean }`. `Button` `type="button"` `variant="cosmic"`
`disabled={!ready}` z ikoną lucide (np. `Rocket`) i etykietą „Embark on the job";
`aria-describedby` wskazuje `<p id="embark-hint">` pod przyciskiem z tekstem: przy `!ready` —
„Every competency needs at least 2 points before the team can embark." (literał 2 z
`COMPETENCY_THRESHOLD`), przy `ready` — „All seven competencies are covered." Bez `onClick`.

#### 6. Spięcie w wyspie i układ

**Plik**: `src/components/team/TeamComposer.tsx`, `src/pages/teams/new.astro`

**Cel**: Wykres i bramka muszą żyć w tej samej wyspie co `composition` (dwie wyspy nie dzielą
stanu); przełącznik perka i jego skutek w jednym polu widzenia (decyzja: dwie kolumny).

**Umowa**: w renderze `const evaluation = evaluateTeam(composition, pool);` (bez memo). Wyspa
przechodzi na `grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`: lewa kolumna to
dotychczasowy nagłówek „Roster" + licznik i sloty w `grid-cols-2`; prawa to `<aside>` z nagłówkiem
„Competencies", `<CompetencyRadar scores={evaluation.scores} threshold={COMPETENCY_THRESHOLD} />`
renderowanym tylko przy `evaluation.violations.length === 0` (gałąź obronna — patrz Krytyczne
szczegóły) oraz `<EmbarkGate ready={evaluation.isValid} />`. Strona: `max-w-4xl` → `max-w-6xl`.
`MemberPickerDialog` bez zmian w tej fazie.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi, w tym nowy `src/lib/radar-geometry.test.ts`
- `npx astro sync && npm run lint` przechodzi (react-compiler, react-hooks 7, strictTypeChecked)
- `npm run build` przechodzi
- `package.json` bez nowych zależności: `git diff --quiet HEAD -- package.json package-lock.json`
- `grep -c "bg-purple-600" src/components/auth/SubmitButton.tsx src/components/team/MemberPickerDialog.tsx` zwraca 0 dla obu

#### Ręczna weryfikacja:

- `npm run dev`, zalogowany na `/teams/new`: dwie kolumny; przy pustym składzie wykres ma siedem
  osi z etykietami, pierścień progu i wielokąt zapadnięty do środka; przycisk „Embark on the job"
  zablokowany z tekstem o 2 punktach
- Po dodaniu Vesper Kane oś `combat` sięga pierścienia progu (etykieta „combat 2"); po usunięciu
  wraca do 0 — zmiana jest natychmiastowa, bez odczuwalnego opóźnienia
- Po sześciu postaciach z przepisu (Vesper, Torque, Sable, Wren, Oyelaran, Ghostline) sześć osi
  jest na progu, `navigation` na 0, przycisk nadal zablokowany
- Dwie postacie o tej samej specjalizacji (np. Vesper + Marlow) dają `combat 4` — wielokąt sięga
  końca osi, nic nie jest obcięte; po dodaniu trzeciej z perkiem combat (Faza 3) skala rośnie
- Przyciski „Add to team" (okno) i „Sign in"/„Sign up" wyglądają jak przed zmianą (wariant
  `cosmic` zamiast kopii klas)

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie użytkownika przed Fazą 3.

---

## Faza 3: Perki na karcie slotu

### Przegląd

Karta zajętego slotu dostaje trzy przełączniki perków spięte z `togglePerk`; okno wyboru dostaje
podpisy. Po tej fazie S-02 jest kompletny: próg da się domknąć, bramka otwiera się i zamyka
w obie strony.

### Wymagane zmiany:

#### 1. Slot z perkami

**Plik**: `src/components/team/RosterSlot.tsx`

**Cel**: FR-014 — wybór maksymalnie dwóch z trzech perków z nazwanym limitem; trzeci perk przy
2/2 wyłączony (decyzja użytkownika).

**Umowa**: props zmieniają się na
`{ member: RosterMember | null; onRecruit(): void; onRemove(characterId: string): void; onTogglePerk(characterId: string, perkId: string): void }`,
gdzie `export interface RosterMember { character: PoolCharacter; selection: MemberSelection }`
(eksport z tego pliku). Zajęty slot renderuje: nazwę; wiersz specjalizacji z podpisem
`+2 {competency}` (literał z `SPECIALIZATION_POINTS`); nagłówek „Perks N/2" (literał
z `MAX_PERKS_PER_MEMBER`); trzy przyciski `type="button"` z `aria-pressed={selected}`, nazwą
perka, kompetencją i „+1", stylem wybranym (`border-purple-400/60 bg-purple-500/20`, jak
zaznaczony wiersz w oknie) vs niewybranym, oraz `disabled={!selected && count >= MAX_PERKS_PER_MEMBER}`;
przycisk „Remove" bez zmian. Pusty slot bez zmian. Karta rośnie w pionie — `min-h-32` może
zostać, siatka 2 kolumn z Fazy 2 daje szerokość.

#### 2. Spięcie z wyspą

**Plik**: `src/components/team/TeamComposer.tsx`

**Cel**: Domknięcie pętli zaznacz/odznacz przez jedynego pisarza.

**Umowa**: `slots` mapują indeks na `RosterMember | null` (postać z `charactersById` + oryginalny
`MemberSelection`; nieznany `characterId` nadal → `null`, jak w S-01 — rozstrzyga S-04).
`handleTogglePerk(characterId, perkId)` → funkcyjne `setComposition((current) => { const result =
togglePerk(current, characterId, perkId, pool); return result.ok ? result.composition : current; })`.
Klucz slotu: `member?.character.id`.

#### 3. Podpisy w oknie wyboru

**Plik**: `src/components/team/MemberPickerDialog.tsx`

**Cel**: Okno zostaje do odczytu, ale nazywa punktację i mówi, gdzie wybiera się perki — obcy bez
tutoriala nie szuka przełączników w oknie.

**Umowa**: wiersz specjalizacji dostaje podpis „+2 points" (literał z `SPECIALIZATION_POINTS`);
każdy perk na liście dostaje „+1"; pod nagłówkiem „Perks — up to 2 of 3 can be chosen" krótki
tekst „Choose them on the roster card after recruiting." Bez przełączników, bez zmiany `onAdd`.

#### 4. Domknięcie wpisu w roadmapie

**Plik**: `context/foundation/roadmap.md`

**Cel**: Niewiadoma S-02 („jak narysować wykres bez ciężkiej zależności") jest rozstrzygnięta —
wpis ma to odnotować, jak przy F-02 i S-01.

**Umowa**: w bloku `### S-02` przepisać punkt Niewiadomych na „**Rozstrzygnięte (2026-09-05,
sesja planowania):** ręczny inline SVG z czystym helperem geometrii `src/lib/radar-geometry.ts`,
zero nowych zależności". Status elementu zmienia `/10x-implement` / `/10x-archive`, nie ta edycja.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx astro sync && npm run lint` przechodzi
- `npm test` przechodzi
- `npm run build` przechodzi
- `package.json` nadal bez nowych zależności: `git diff --quiet HEAD -- package.json package-lock.json`

#### Ręczna weryfikacja:

- Karta zajętego slotu pokazuje `+2 <specjalizacja>`, „Perks 0/2" i trzy perki; klik zaznacza
  perk (licznik `1/2`, oś kompetencji perka rośnie o 1 na wykresie od razu); ponowny klik
  odznacza
- Przy 2/2 trzeci perk jest wyłączony; odznaczenie jednego odblokowuje go
- Przepis: sześć postaci (Vesper, Torque, Sable, Wren, Oyelaran, Ghostline) + „Extraction
  Routes" u Vesper + „Service Tunnel Access" u Torque → `navigation 2`, wszystkie osie na
  pierścieniu, przycisk „Embark on the job" odblokowany, tekst „All seven competencies are
  covered."; klik nie robi nic (S-03)
- Zdjęcie „Service Tunnel Access" blokuje przycisk z powrotem; ponowne zaznaczenie odblokowuje;
  usunięcie Ghostline (hacking → 0) blokuje ponownie (FR-015 dwukierunkowo)
- Okno wyboru: „+2 points" przy specjalizacji, „+1" przy perkach, wskazówka o karcie; perki
  w oknie nie są klikalne
- Odświeżenie strony zeruje skład i wykres (bez trwałości — S-01)

---

## Strategia testowania

### Testy jednostkowe:

- `src/lib/domain/roster.test.ts` — `togglePerk`: limit 2, odznaczanie, przynależność perka,
  kolejność, niemutowalność; zgodność z `too-many-perks` / `unknown-perk`; próg osiągalny
  wyłącznie przez `addMember` + `togglePerk` na `findThresholdSolution(CHARACTER_POOL)`.
- `src/lib/radar-geometry.test.ts` — równe kąty, pierwsza oś w górę, wartość ↔ promień, pierścień
  progu, skala nigdy nie obcina, brak mutacji.

### Testy integracyjne:

- Brak — z konstrukcji (twarde reguły: testy czyste, bez jsdom). Spięcie `evaluateTeam` z wyspą,
  bramka i przełączniki są weryfikowane ręcznie.

### Kroki testowania ręcznego:

1. Zalogowany → `/teams/new` → dwie kolumny, pusty wykres, przycisk zablokowany z tekstem.
2. Dodaj Vesper → `combat 2`; usuń → `combat 0`.
3. Dodaj sześć postaci z przepisu → sześć osi na progu, `navigation 0`, przycisk zablokowany.
4. Zaznacz „Extraction Routes" (Vesper) i „Service Tunnel Access" (Torque) → `navigation 2`,
   przycisk odblokowany, tekst „All seven competencies are covered."; klik bez skutku.
5. Spróbuj trzeciego perka u Vesper → wyłączony; odznacz jeden → dostępny.
6. Odznacz „Service Tunnel Access" → przycisk zablokowany; usuń Ghostline → nadal zablokowany;
   przywróć oba → odblokowany.
7. Dodaj Marlow zamiast kogoś → `combat 4`, wielokąt na końcu osi; zaznacz perk combat u trzeciej
   postaci → skala rośnie do 5, nic nie obcięte.
8. Odśwież → wszystko wyzerowane.

## Uwagi dotyczące wydajności

Wymóg NFR „< 200 ms od wyboru": `evaluateTeam` to siedem liczników nad ≤ 6 członkami
i ≤ 12 perkami, `radarLayout` to 7 × kilka operacji trygonometrycznych — oba liczone przy każdym
renderze wyspy, bez memoizacji (react-compiler jest włączony jako `error` i memoizuje sam;
poprzednie plany wprost zakazują `useMemo` na zapas). Weryfikacja ręczna: zmiana jest
natychmiastowa w `npm run dev`.

## Uwagi dotyczące migracji

Brak migracji, zmian schematu i **zero nowych zależności** — kryterium automatyczne w Fazach 2 i 3
pilnuje `package.json`/`package-lock.json`. Zmiana propsów `RosterSlot` (Faza 3) jest zmianą
łamiącą wewnątrz fragmentu; jedynym konsumentem jest `TeamComposer`.

## Referencje

- Roadmapa: `context/foundation/roadmap.md` → `### S-02`
- Poprzednik: `context/archive/2026-09-05-team-roster-composition/plan.md`,
  `.../reviews/impl-review.md` (F6 → wariant `cosmic`; F3 → bez literałów id w testach)
- Umowa `scores`/`violations`: `src/lib/domain/evaluate-team.ts:23-32`;
  `context/archive/2026-08-30-domain-rule-verification-harness/reviews/impl-review.md`
- Wzorzec pisarza składu i testu zgodności: `src/lib/domain/roster.ts`,
  `src/lib/domain/roster.test.ts:117-178`
- Solver do testu progu: `src/lib/domain/solvability.ts:129`, użycie w
  `src/lib/domain/character-pool.test.ts:77`
- Wzorzec czystego helpera w `src/lib/` z testem: `src/lib/utils.ts`, `src/lib/utils.test.ts`
- Wymagania: `context/foundation/prd.md` FR-014, FR-015, FR-016, FR-018, NFR 200 ms, Guardrail
  „wykres zawsze zgodny ze składem"

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku. Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Pisarz perków w domenie

#### Automatyczne

- [x] 1.1 `npm test` przechodzi, w tym rozszerzony `src/lib/domain/roster.test.ts`
- [x] 1.2 `npx astro sync && npm run lint` przechodzi
- [x] 1.3 `src/lib/domain/` bez importów `astro:*` / `@/lib/supabase`

#### Ręczne

- [x] 1.4 Kontrola mutacyjna `MAX_PERKS_PER_MEMBER` → 3 wywala test (drzewo przywrócone)

### Faza 2: Wykres pajęczynowy i bramka

#### Automatyczne

- [ ] 2.1 `npm test` przechodzi, w tym `src/lib/radar-geometry.test.ts`
- [ ] 2.2 `npx astro sync && npm run lint` przechodzi
- [ ] 2.3 `npm run build` przechodzi
- [ ] 2.4 `package.json` / `package-lock.json` bez zmian
- [ ] 2.5 Brak `bg-purple-600` w `SubmitButton.tsx` i `MemberPickerDialog.tsx`

#### Ręczne

- [ ] 2.6 Dwie kolumny; pusty skład → siedem osi, pierścień progu, przycisk zablokowany z tekstem
- [ ] 2.7 Dodanie/usunięcie Vesper → `combat 2` / `combat 0` natychmiast
- [ ] 2.8 Sześć postaci z przepisu → sześć osi na progu, `navigation 0`, przycisk zablokowany
- [ ] 2.9 Vesper + Marlow → `combat 4` na końcu osi, bez obcięcia
- [ ] 2.10 „Add to team" i „Sign in"/„Sign up" wyglądają jak przed zmianą

### Faza 3: Perki na karcie slotu

#### Automatyczne

- [ ] 3.1 `npx astro sync && npm run lint` przechodzi
- [ ] 3.2 `npm test` przechodzi
- [ ] 3.3 `npm run build` przechodzi
- [ ] 3.4 `package.json` / `package-lock.json` bez zmian

#### Ręczne

- [ ] 3.5 Karta slotu: `+2 <specjalizacja>`, „Perks 0/2", trzy perki; zaznaczenie i odznaczenie działają, wykres reaguje od razu
- [ ] 3.6 Przy 2/2 trzeci perk wyłączony; odznaczenie odblokowuje
- [ ] 3.7 Przepis domyka próg → wszystkie osie na pierścieniu, przycisk odblokowany, tekst „All seven competencies are covered.", klik bez skutku
- [ ] 3.8 Zdjęcie perka / usunięcie członka blokuje przycisk z powrotem; przywrócenie odblokowuje
- [ ] 3.9 Okno wyboru: „+2 points", „+1" przy perkach, wskazówka o karcie, perki nieklikalne
- [ ] 3.10 Odświeżenie strony zeruje skład i wykres
