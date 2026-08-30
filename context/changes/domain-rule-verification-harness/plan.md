# Wykonywalna weryfikacja reguły siedmiu kompetencji — plan implementacji

## Przegląd

Wydzielamy regułę domenową team-makera — siedem kompetencji, próg dwóch punktów, limity składu —
do jednego czystego modułu w `src/lib/domain/` i wpinamy w projekt uruchamiacz testów, który
sprawdza ją jednym poleceniem: lokalnie i w CI. To fundament F-01 z mapy drogowej: nie dowozi
niczego widocznego dla użytkownika, ale ustala kontrakt, na którym opierają się fragmenty
S-01 … S-08, i domyka jedyną lukę bazową, którą PRD nazywa wprost wiążącą.

## Analiza bieżącego stanu

- **Zero domeny.** `src/lib/` zawiera dziś wyłącznie `supabase.ts` (klient sesyjny),
  `utils.ts` (`cn()`) i `config-status.ts`. Nie istnieje żaden typ postaci, perka, kompetencji ani
  drużyny. Regułę trzeba **napisać**, nie tylko obudować testem.
- **Zero uruchamiacza testów.** `package.json` nie ma ani skryptu `test`, ani żadnego runnera
  w `devDependencies`. `AGENTS.md` odnotowuje to jako stan świadomy: „No test runner is installed,
  and `zod` is not a dependency. Do not add test commands or zod validation unless asked.”
- **CI ma trzy kroki.** `.github/workflows/ci.yml`: `npx astro sync` → `npm run lint` →
  `npm run build`. Krok `build` jako jedyny konsumuje sekrety `SUPABASE_URL` / `SUPABASE_KEY`.
- **ESLint jest typowany i wszechogarniający.** `eslint.config.js` włącza
  `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` z `projectService`, a
  `tsconfig.json` ma `include: [".astro/types.d.ts", "**/*"]`. Każdy nowy plik `.ts` — łącznie
  z konfiguracją narzędzia i plikami testowymi — wchodzi pod typowany lint.
- **Vite 7 jest już w drzewie zależności** (`overrides: { vite: "^7.3.2" }`), bo używa go Astro 6.
- **Liczby reguły są w PRD twarde** (`## Business Logic`): postać wnosi 2 punkty do jednej
  kompetencji ze swojej specjalizacji, perk wnosi 1 punkt do jednej kompetencji; skład to 0–6
  różnych postaci, każda z 0–2 perkami wybranymi z trzech; próg to 2 punkty w każdej z siedmiu
  kompetencji. Sześć postaci wnosi najwyżej sześć specjalizacji przy siedmiu kompetencjach, więc
  perki są konieczne w każdym poprawnym rozwiązaniu.

## Pożądany stan końcowy

Po zakończeniu planu w repozytorium istnieje `src/lib/domain/` — czysty moduł bez żadnej
zależności od Astro, Supabase i przeglądarki — który dla dowolnego składu zwraca siedem sum
punktowych, liczbę punktów brakujących w każdej kompetencji, listę naruszonych limitów składu
i binarny werdykt. `npm test` uruchamia zestaw nazwanych przypadków wiążących tę regułę, a CI
przechodzi przez ten sam krok między `lint` a `build`.

Weryfikacja stanu końcowego: `npm test` kończy się zielono; podniesienie progu lub rozluźnienie
limitu w module domenowym czerwieni zestaw; `npm run lint` i `npm run build` nadal przechodzą;
`.github/workflows/ci.yml` zawiera krok testowy; `AGENTS.md` opisuje polecenie testowe zgodnie
z `package.json`.

### Kluczowe odkrycia:

- `src/lib/supabase.ts:3` importuje `astro:env/server` — wirtualny moduł istniejący wyłącznie
  w runtime Astro. Moduł domenowy nie może go dotknąć (ani bezpośrednio, ani przez import
  pośredni), inaczej test wymaga bootstrapu Astro zamiast być czystą funkcją.
- Vitest **nie ładuje** `astro.config.mjs` (to nie jest konfiguracja Vite), więc adapter
  Cloudflare i schemat `env` nie wejdą testom w drogę — pod warunkiem czystości modułu.
- Vitest 4.1.11 deklaruje `peerDependencies.vite: "^6 || ^7 || ^8"` i `engines.node:
  "^20 || ^22 || >=24"` — zgodne z `overrides.vite: ^7.3.2` i `.nvmrc` 22.14.0.
- Alias `@/*` (`tsconfig.json`) nie działa w Vitest bez konfiguracji; wystarczy jedno pole
  `resolve.alias` w `vitest.config.ts` — dodatkowa paczka (`vite-tsconfig-paths`) jest zbędna.
- `.github/workflows/ci.yml:20` (`npm run build`) jako jedyny krok wymaga sekretów; krok testowy
  wstawiony **przed** nim działa również na PR-ach bez dostępu do sekretów.
- `src/middleware.ts:4` (`PROTECTED_ROUTES`) i wzorzec przekierowania z błędem w
  `src/pages/api/auth/signin.ts:11` to kontrakty, których ten plan **nie dotyka** — pojawią się
  dopiero w S-03 i S-04.

## Czego NIE robimy

- **Bazy danych i migracji Supabase.** Zero tabel, zero polityk RLS, zero `supabase/migrations/`.
  To wchodzi z S-03.
- **Trasy API zapisu drużyny.** Weryfikacja obejmuje wyłącznie czystą regułę — decyzja
  z sesji planowania, zamykająca otwarte pytanie mapy drogowej #2.
- **Weryfikacji izolacji dwóch kont.** Guardrail „izolacja danych między kontami” zostanie
  udowodniony w S-07, gdy będzie istniała pętla CRUD.
- **Prawdziwej puli 10–12 postaci ani weryfikacji jej rozwiązywalności.** To jest wynik F-02.
  Ten plan dostarcza wyłącznie fixture'y pisane pod konkretne przypadki reguły.
- **Interfejsu użytkownika, wykresu pajęczynowego, licznika braków.** S-01, S-02, S-08.
- **Walidacji `zod`.** `AGENTS.md` trzyma to jako twardą regułę i nikt o to nie prosił; reguła
  domenowa jest funkcją nad typami TypeScriptu, nie schematem walidacji wejścia HTTP.
- **Testów E2E, przeglądarkowych i komponentowych.** Żaden test nie renderuje Reacta ani Astro.
- **Progów pokrycia kodu, raportów coverage, trybu watch w CI.**
- **Skryptu CLI przyjmującego skład z terminala.** Rozważony i odrzucony w sesji planowania:
  „dowolny skład” realizujemy przez dopisanie przypadku do zestawu.
- **Zmian we wdrożeniu, `wrangler.jsonc`, konfiguracji Supabase.**

## Podejście do implementacji

Trzy fazy w kolejności rosnącego ryzyka rozjazdu. Najpierw narzędzie — bo uruchamiacz testów
jest pierwszą nową zależnością w projekcie i to on może pokłócić się z typowanym ESLint-em,
buildem Astro albo CI; kończymy go na drobnym, ale prawdziwym teście istniejącego `cn()`, który
przy okazji dowodzi, że alias `@/*` działa w testach. Potem kontrakt — typy i jedna funkcja,
weryfikowane na tym etapie wyłącznie typami i buildem. Na końcu zestaw weryfikacyjny, który
dopiero wiąże regułę zachowaniem i jest właściwym produktem tego fundamentu.

Rozdzielenie faz 2 i 3 jest celowe: kontrakt trafia do repozytorium jako osobny commit, więc
jeśli późniejszy fragment go zmieni, różnica jest czytelna bez przekopywania się przez testy.

## Krytyczne szczegóły implementacji

**Czystość modułu domenowego jest wiążąca, nie stylistyczna.** `src/lib/domain/**` nie może
importować `astro:*`, `@/lib/supabase` ani niczego z `src/pages/`. Złamanie tego nie wywali się
przy buildzie — wywali się dopiero przy uruchomieniu testu, komunikatem o nierozwiązanym module
wirtualnym, którego przyczyna jest nieoczywista.

**Kolejność w CI ma znaczenie.** Krok testowy musi stanąć przed `npm run build`, bo build jest
jedynym krokiem wymagającym sekretów Supabase. Test za buildem przestaje dawać sygnał na
przebiegach bez sekretów.

**Testy importują `describe`/`it`/`expect` jawnie z `"vitest"`.** Włączenie `globals: true`
wymagałoby dołożenia typów globalnych i pogodzenia ich z `strictTypeChecked` + `projectService`
— koszt bez zysku przy jawnym imporcie.

---

## Faza 1: Uruchamiacz testów wpięty w projekt i CI

### Przegląd

Projekt zyskuje polecenie `npm test`, które działa lokalnie i w CI, oraz dokumentację zgodną
z rzeczywistością. Faza kończy się na jednym prawdziwym teście istniejącego kodu — dowodzi, że
narzędzie żyje i że alias `@/*` rozwiązuje się w testach, zanim powstanie cokolwiek do
weryfikowania.

### Wymagane zmiany:

#### 1. Zależność i skrypt testowy

**Plik**: `package.json`

**Cel**: Dodać `vitest` jako narzędzie deweloperskie i wystawić jedno polecenie uruchamiające
weryfikację jednorazowo (bez trybu watch), tak aby to samo polecenie działało u człowieka i w CI.

**Kontrakt**: nowy wpis w `devDependencies` (`vitest`, wersja `^4.1.11`) oraz skrypt
`"test": "vitest run"` w bloku `scripts`. `vitest run` jest istotne — domyślne `vitest` wchodzi
w tryb watch i zawiesiłoby CI. Blok `lint-staged` pozostaje bez zmian: pliki testowe to `*.ts`,
więc już są objęte regułą `eslint --fix`.

#### 2. Konfiguracja uruchamiacza

**Plik**: `vitest.config.ts` (nowy, w katalogu głównym)

**Cel**: Nauczyć Vitest aliasu `@/*` używanego w całym projekcie i zawęzić wyszukiwanie testów
do `src/`, żeby runner nie zaglądał do `dist/`, `.astro/` ani `context/`.

**Kontrakt**: `defineConfig` z `vitest/config`; `resolve.alias` mapujące `@` na katalog `src`;
`test.include` ograniczone do wzorca plików `*.test.ts` w `src/`. Plik NIE importuje
`astro.config.mjs` ani żadnego modułu z `src/`. Środowisko pozostaje domyślne (`node`) — nic tu
nie renderuje DOM-u.

#### 3. Krok testowy w CI

**Plik**: `.github/workflows/ci.yml`

**Cel**: Wpiąć weryfikację w bramkę, która i tak działa na każdym push do `main` i każdym PR —
inaczej powtórzy się ryzyko nazwane w F-01: weryfikacja dorobiona obok procesu zostaje pominięta.

**Kontrakt**: nowy krok `- run: npm test` między istniejącymi krokami `npm run lint`
i `npm run build`. Krok nie dostaje bloku `env` — nie potrzebuje sekretów.

#### 4. Korekta reguł repozytorium

**Plik**: `AGENTS.md`

**Cel**: Sekcja „Hard rules” twierdzi dziś, że runnera nie ma i że nie wolno dodawać poleceń
testowych. Po tej fazie to zdanie jest nieprawdziwe w pierwszej połowie, a wciąż wiążące
w drugiej (`zod`).

**Kontrakt**: przeredagowana pozycja listy „Hard rules” — mówi, że uruchamiaczem jest Vitest
(`npm test` = `vitest run`), że testy są czyste i nie bootstrapują Astro ani Supabase, oraz że
`zod` nadal nie jest zależnością. Dodatkowo `npm test` w sekcji „Commands” obok istniejącego
opisu skryptów.

#### 5. Pierwszy test — dowód, że narzędzie działa

**Plik**: `src/lib/utils.test.ts` (nowy)

**Cel**: Sprawdzić `cn()` z `src/lib/utils.ts` — scalanie klas Tailwind i rozstrzyganie kolizji.
Test jest drobny, ale prawdziwy i zostaje w repozytorium na stałe; przy okazji dowodzi, że import
przez alias `@/lib/utils` rozwiązuje się w Vitest.

**Kontrakt**: jawne importy `describe`/`it`/`expect` z `"vitest"`; import testowanego modułu
przez alias `@/lib/utils`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` uruchamia się i przechodzi
- Linting przechodzi: `npm run lint` (pliki testowe i `vitest.config.ts` pod `strictTypeChecked`)
- Build przechodzi: `npx astro sync && npm run build`
- `.github/workflows/ci.yml` zawiera krok `npm test` między `npm run lint` a `npm run build`

#### Weryfikacja ręczna:

- `AGENTS.md` nie twierdzi już, że uruchamiacza testów nie ma, a opisane polecenie zgadza się
  z blokiem `scripts` w `package.json`

**Uwaga implementacyjna**: Po zakończeniu tej fazy i pomyślnym przejściu automatycznych
weryfikacji zatrzymaj się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Kontrakt reguły domenowej

### Przegląd

Powstaje `src/lib/domain/` — siedem kompetencji jako typ związany, encje postaci i perka, stałe
reguły oraz jedna funkcja `evaluateTeam()` zwracająca komplet wyjść z `## Business Logic` PRD.
Na tym etapie weryfikacja jest typowa i budowlana; zachowanie wiąże dopiero Faza 3.

### Wymagane zmiany:

#### 1. Kompetencje, encje i stałe reguły

**Plik**: `src/lib/domain/types.ts` (nowy)

**Cel**: Ustalić siedem kompetencji jako typ związany oraz kształt wejścia reguły: zamkniętą pulę
postaci (każda ze specjalizacją i trzema perkami) i skład jako listę wyborów gracza. Stałe reguły
mieszkają tutaj, żeby żaden późniejszy fragment nie wpisał progu ani limitu na sztywno.

**Kontrakt**: nazwy kompetencji są **robocze** — F-02 może je zamienić na docelowe, fabularne.
Typ związany jest tu istotny: dzięki niemu wynik reguły ma dokładnie siedem pól i kompilator
pilnuje kompletności osi wykresu z S-02.

```ts
export const COMPETENCIES = [
  "combat", "hacking", "stealth", "engineering", "medicine", "negotiation", "navigation",
] as const;
export type Competency = (typeof COMPETENCIES)[number];

export const COMPETENCY_THRESHOLD = 2;   // FR-018
export const MAX_TEAM_SIZE = 6;          // FR-012
export const MAX_PERKS_PER_MEMBER = 2;   // FR-014
export const PERKS_PER_CHARACTER = 3;    // FR-014
export const SPECIALIZATION_POINTS = 2;  // ## Business Logic
export const PERK_POINTS = 1;            // ## Business Logic

export interface Perk { id: string; competency: Competency }
export interface Character { id: string; specialization: Competency; perks: readonly Perk[] }
export interface MemberSelection { characterId: string; perkIds: readonly string[] }
export type CharacterPool = readonly Character[];
export type TeamComposition = readonly MemberSelection[];
```

#### 2. Reguła domenowa

**Plik**: `src/lib/domain/evaluate-team.ts` (nowy)

**Cel**: Policzyć siedem sum ze specjalizacji i wybranych perków, wyliczyć braki do progu, zebrać
naruszone limity składu i wydać binarny werdykt — w jednym wywołaniu, żeby wykres z S-02, licznik
z S-08 i bramka zapisu z S-03/S-05 czytały jedno źródło i nie mogły się rozjechać
(Guardrail „wykres zawsze zgodny ze składem”).

**Kontrakt**: `isValid` jest koniunkcją dwóch niezależnych warunków — brak naruszeń **oraz**
każda kompetencja co najmniej na progu. Skład łamiący limit nigdy nie dostaje werdyktu
pozytywnego, nawet gdy sumy punktowe próg przekraczają; to jest zapis PRD „limity składu nie do
obejścia”. Funkcja jest czysta: nie mutuje wejścia, nie sięga po zegar, nie loguje.

```ts
export type RuleViolation =
  | { kind: "too-many-members"; count: number }
  | { kind: "duplicate-character"; characterId: string }
  | { kind: "too-many-perks"; characterId: string; count: number }
  | { kind: "unknown-character"; characterId: string }
  | { kind: "unknown-perk"; characterId: string; perkId: string };

export interface TeamEvaluation {
  scores: Record<Competency, number>;     // siedem sum
  missing: Record<Competency, number>;    // brakujące punkty do progu, 0 gdy domknięte
  violations: readonly RuleViolation[];   // naruszone limity składu
  isValid: boolean;                       // binarny werdykt
}

export function evaluateTeam(composition: TeamComposition, pool: CharacterPool): TeamEvaluation;
```

#### 3. Punkt wejścia modułu

**Plik**: `src/lib/domain/index.ts` (nowy)

**Cel**: Dać późniejszym fragmentom jeden import (`@/lib/domain`) zamiast wiedzy o wewnętrznym
podziale modułu na pliki.

**Kontrakt**: re-eksport publicznej powierzchni z `types.ts` i `evaluate-team.ts`. Nic więcej —
zero logiki.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Sprawdzanie typów i linting przechodzą: `npx astro sync && npm run lint`
- Build przechodzi: `npm run build`
- `npm test` nadal przechodzi (nowy moduł nie psuje testu z Fazy 1)
- `src/lib/domain/` nie zawiera importu z `astro:` ani z `@/lib/supabase`:
  `grep -rE "astro:|lib/supabase" src/lib/domain/` nie zwraca dopasowań

#### Weryfikacja ręczna:

- Sygnatura `evaluateTeam` pokrywa wszystkie trzy wyjścia nazwane w `## Business Logic` PRD
  (siedem sum, brakujące punkty, binarny werdykt) plus naruszenia limitów składu

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie przed
przejściem do Fazy 3.

---

## Faza 3: Zestaw weryfikacyjny reguły

### Przegląd

Właściwy produkt fundamentu: nazwane przypadki, które wiążą regułę zachowaniem. Zestaw pokrywa
punktację, próg w obie strony, każdy z czterech limitów składu osobno oraz właściwość liczbową
z PRD („sześć specjalizacji nie wystarcza na siedem kompetencji”).

### Wymagane zmiany:

#### 1. Fixture'y pod przypadki reguły

**Plik**: `src/lib/domain/test-fixtures.ts` (nowy)

**Cel**: Dostarczyć małą, jawną pulę postaci pisaną pod przypadki testowe oraz budowniczych
składu, żeby każdy test czytał się jak zdanie o regule, a nie jak stos literałów. Plik jest
importowany wyłącznie przez testy, więc nie trafia do bundla aplikacji.

**Kontrakt**: pula pokrywająca wszystkie siedem kompetencji specjalizacjami i perkami w takim
doborze, by istniał skład domykający próg oraz skład o dokładnie jeden punkt za krótki. To NIE
jest docelowa pula 10–12 postaci — ta powstaje w F-02.

#### 2. Zestaw przypadków

**Plik**: `src/lib/domain/evaluate-team.test.ts` (nowy)

**Cel**: Związać każdy zapis reguły z osobnym, nazwanym przypadkiem — w szczególności trzy
przypadki limitów muszą sprawdzać werdykt negatywny **mimo** domkniętych sum punktowych, inaczej
przechodziłyby przypadkiem.

**Kontrakt**: przypadki wymienione w `## Strategia testowania` poniżej; jawne importy z
`"vitest"`; import reguły przez alias `@/lib/domain`.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- `npm test` przechodzi ze wszystkimi przypadkami z `## Strategia testowania`
- Linting przechodzi: `npm run lint`
- Build przechodzi: `npx astro sync && npm run build`

#### Weryfikacja ręczna:

- Mutacja kontrolna: zmiana `COMPETENCY_THRESHOLD` z 2 na 1 czerwieni zestaw; zmiana cofnięta
- Mutacja kontrolna: podniesienie `MAX_TEAM_SIZE` z 6 na 7 czerwieni zestaw; zmiana cofnięta
- Przebieg CI na PR jest zielony i pokazuje krok testowy między `lint` a `build`

---

## Strategia testowania

### Testy jednostkowe:

Punktacja i próg:

1. Pusty skład → wszystkie sumy 0, brak 2 punktów w każdej z siedmiu kompetencji,
   `isValid === false`, zero naruszeń.
2. Specjalizacja wnosi 2 punkty, perk wnosi 1 — suma kumuluje się z wielu źródeł w tej samej
   kompetencji (wynik powyżej progu jest poprawny, nie jest przycinany).
3. Skład domykający próg → wszystkie `missing` zerowe, `isValid === true`.
4. Skład o dokładnie jeden punkt za krótki w jednej kompetencji → `isValid === false`,
   a `missing` wskazuje dokładnie tę jedną kompetencję z wartością 1.
5. Sześć postaci bez ani jednego perka nigdy nie domyka progu — właściwość liczbowa z PRD
   (sześć specjalizacji przy siedmiu kompetencjach).

Limity składu (każdy z werdyktem negatywnym **mimo** sum przekraczających próg):

6. Siedmiu członków → naruszenie `too-many-members`, `isValid === false`.
7. Ta sama postać dwukrotnie → `duplicate-character`, `isValid === false`.
8. Trzy perki u jednego członka → `too-many-perks`, `isValid === false`.
9. Perk nienależący do wybranej postaci → `unknown-perk`, `isValid === false`.
10. Postać spoza puli → `unknown-character`, `isValid === false`.

Czystość:

11. `evaluateTeam` nie mutuje przekazanego składu ani puli.

### Testy integracyjne:

Brak — ten fundament nie ma z czym się integrować. Ścieżka zapisu wchodzi w S-03, izolacja kont
w S-07; obie dołożą własną weryfikację na tym samym module.

### Kroki testowania ręcznego:

1. `npm test` — zestaw zielony, przypadki wypisane z nazwami.
2. Podnieś `COMPETENCY_THRESHOLD` do 1, uruchom `npm test` — zestaw czerwony. Cofnij.
3. Podnieś `MAX_TEAM_SIZE` do 7, uruchom `npm test` — zestaw czerwony. Cofnij.
4. Otwórz PR i potwierdź, że CI pokazuje krok testowy między `lint` a `build`.

## Uwagi dotyczące wydajności

Reguła liczy siedem liczników nad co najwyżej sześcioma członkami i dwunastoma perkami — koszt
jest pomijalny wobec budżetu 200 ms z wymagań pozafunkcjonalnych PRD, także przy przeliczaniu po
każdym kliknięciu w S-02. Żadna memoizacja nie jest tu potrzebna i nie należy jej dodawać.

Vitest dokłada kilkadziesiąt paczek tranzytywnych do `devDependencies` i kilka sekund do przebiegu
CI. To jest jedyny mierzalny koszt tego fundamentu i został przyjęty świadomie.

## Uwagi dotyczące migracji

Brak danych do zmigrowania — projekt nie ma jeszcze ani jednej tabeli. Wycofanie zmiany to
usunięcie `src/lib/domain/`, `src/lib/utils.test.ts`, `vitest.config.ts`, kroku w CI oraz wpisów
w `package.json`; nic poza tym nie zależy od tej zmiany w chwili jej powstania.

Nazwy siedmiu kompetencji są robocze. Jeśli F-02 zamieni je na docelowe, zmiana dotknie
`types.ts`, fixture'ów i asercji odwołujących się do nazw — kompilator wskaże każde miejsce,
bo `Competency` jest typem związanym.

## Referencje

- Element mapy drogowej: `context/foundation/roadmap.md` → F-01
- Reguła domenowa: `context/foundation/prd.md` → `## Business Logic`, FR-012, FR-014, FR-018
- Guardraile: `context/foundation/prd.md` → `## Success Criteria` → Guardrails
- Reguły repozytorium: `AGENTS.md` → Hard rules, Commands
- Istniejący moduł do naśladowania (czysty, bez zależności runtime): `src/lib/utils.ts`
- Kontrakt, którego ten plan NIE dotyka: `src/middleware.ts:4` (`PROTECTED_ROUTES`)

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Zobacz `references/progress-format.md`.

### Faza 1: Uruchamiacz testów wpięty w projekt i CI

#### Automatyczne

- [x] 1.1 `npm test` uruchamia się i przechodzi
- [x] 1.2 Linting przechodzi: `npm run lint`
- [x] 1.3 Build przechodzi: `npx astro sync && npm run build`
- [x] 1.4 `.github/workflows/ci.yml` zawiera krok `npm test` między `npm run lint` a `npm run build`

#### Ręczne

- [x] 1.5 `AGENTS.md` nie twierdzi już, że uruchamiacza testów nie ma, a polecenie zgadza się z `package.json`

### Faza 2: Kontrakt reguły domenowej

#### Automatyczne

- [ ] 2.1 Sprawdzanie typów i linting przechodzą: `npx astro sync && npm run lint`
- [ ] 2.2 Build przechodzi: `npm run build`
- [ ] 2.3 `npm test` nadal przechodzi
- [ ] 2.4 `grep -rE "astro:|lib/supabase" src/lib/domain/` nie zwraca dopasowań

#### Ręczne

- [ ] 2.5 Sygnatura `evaluateTeam` pokrywa trzy wyjścia z `## Business Logic` plus naruszenia limitów

### Faza 3: Zestaw weryfikacyjny reguły

#### Automatyczne

- [ ] 3.1 `npm test` przechodzi ze wszystkimi przypadkami ze `## Strategia testowania`
- [ ] 3.2 Linting przechodzi: `npm run lint`
- [ ] 3.3 Build przechodzi: `npx astro sync && npm run build`

#### Ręczne

- [ ] 3.4 Mutacja kontrolna progu (2 → 1) czerwieni zestaw; zmiana cofnięta
- [ ] 3.5 Mutacja kontrolna limitu składu (6 → 7) czerwieni zestaw; zmiana cofnięta
- [ ] 3.6 Przebieg CI na PR jest zielony i pokazuje krok testowy między `lint` a `build`
