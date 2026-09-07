---
date: 2026-09-07T15:58:27+02:00
researcher: jakubburkiewicz
git_commit: 1ad56fb4b338350a025773259ca7113d4aa3cd6e
branch: main
repository: team-maker
topic: "Bariera serwerowa zapisu drużyny — gdzie mieszka reguła, czego nie widzi żaden test i jak wykonać tor zapisu bez łamania reguły czystości testów"
tags: [research, codebase, api-teams, team-submission, evaluate-team, vitest, test-purity]
status: complete
last_updated: 2026-09-07
last_updated_by: jakubburkiewicz
last_updated_note: "Otwarte pytanie #1 rozstrzygnięte — reguła czystości testów w AGENTS.md przepisana na kryterium ewaluacji w runtime; §7 i Summary zaktualizowane."
---

# Research: Bariera serwerowa zapisu drużyny (test-plan, faza 1)

**Date**: 2026-09-07T15:58:27+02:00
**Researcher**: jakubburkiewicz
**Git Commit**: `1ad56fb4b338350a025773259ca7113d4aa3cd6e` (niewypchnięty — `origin/main` stoi na `76fbf96`, więc dokument używa kotwic lokalnych, nie permalinków)
**Branch**: main
**Repository**: team-maker

## Research Question

Faza 1 wdrożenia z `context/foundation/test-plan.md` §3. Ryzyka #1 (skład poniżej progu zostaje
utrwalony) i #6 (limity składu do obejścia żądaniem z pominięciem interfejsu). Zgodnie z §2
_Risk Response Guidance_ badanie ma ugruntować cztery rzeczy: punkt wejścia zapisu; czy tor
zapisu woła regułę progu przed utrwaleniem; kształt odmowy; **jak pogodzić test wykonawczy
z regułą czystości testów z `AGENTS.md`**.

## Summary

**Bariera stoi.** Obie trasy zapisu wołają tę samą czystą bramkę `gateTeamSubmission`, która
składa parser kształtu z `evaluateTeam`, a `evaluateTeam` egzekwuje próg **i** wszystkie trzy
limity plus trzy dodatkowe warianty (powtórzony perk, nieznana postać, nieznany perk). Reguła
i bramka mają gęste pokrycie jednostkowe. Ryzyka #1 i #6 **nie są dziś awarią w kodzie**.

**Luka jest gdzie indziej i jest dokładnie tą, którą opisuje `lessons.md`.** Nic nie wiąże
faktu, że trasa tę bramkę **woła**. Usunięcie z `src/pages/api/teams/index.ts` trzech linii
`if (!gate.ok) return …` zostawia komplet 17 plików testowych na zielono, a produkt utrwala
dowolny skład. Cała sekwencja trasy — sesja, klient, `formData()`, pula, bramka, repo, cel
redirectu — nie ma ani jednej asercji, bo żaden `*.test.ts` nie importuje niczego z `src/pages/`.
To jest „strażnik zielony na rozbrojonej barierze" w czystej postaci, tyle że tu strażnika nie
ma w ogóle.

**Blokerem wykonania jest jedna krawędź importu, nie architektura.** `src/pages/api/teams/index.ts`
importuje `@/lib/supabase`, a ten w linii 3 importuje `astro:env/server`. Nic innego w drzewie
importów trasy nie jest nieczyste — `import type { APIRoute } from "astro"` jest kasowany przy
transpilacji, a oba repo (`character-pool-repo`, `team-repo`) już biorą klienta argumentem.
Podagent uruchomił sondę: import trasy w Vitest pada wyłącznie na
`Cannot find package 'astro:env/server' imported from src/lib/supabase.ts`.

**Cztery drogi, wszystkie przesondowane empirycznie**, są opisane w §_Opcje wykonania_ poniżej.
Dwie z nich (`vi.mock` na `@/lib/supabase`; osobny projekt Vitest z aliasem) faktycznie wykonują
złożenie trasy end-to-end w Node i **działają dziś**. Trzecia (czysty rdzeń handlera) nie broni
glue'u trasy i przesuwa dziurę o jedno piętro zamiast ją zamknąć.

> **Rozstrzygnięte 2026-09-07, po badaniu.** Reguła czystości testów w `AGENTS.md` została
> przepisana z kryterium tekstowego („nic pod testem nie może importować `astro:*` ani
> `@/lib/supabase`") na kryterium faktyczne: liczy się, **co ewaluuje się w runtime testu**.
> `vi.mock("@/lib/supabase", …)` jest hoistowany, więc prawdziwy moduł nigdy się nie ładuje —
> opcja (a) jest zgodna z regułą, nie wyjątkiem od niej. Poniższa tabela §7 zachowuje kolumnę
> „zgodność" w brzmieniu sprzed tej zmiany, bo dokumentuje stan zastany; wiążące jest
> `AGENTS.md`.

**Granica ryzyka #1 jest węższa, niż sugeruje sformułowanie „poza interfejsem".** Zweryfikowane:
`SUPABASE_KEY` jest `context: "server", access: "secret"` ([astro.config.mjs:29](astro.config.mjs#L29)),
a żaden komponent w `src/components/` ani `src/layouts/` nie dotyka Supabase. Klucz nie trafia
do przeglądarki, więc bezpośredni zapis przez PostgREST nie jest ścieżką dostępną recenzentowi.
Realną powierzchnią ataku dla #1 i #6 jest **spreparowane żądanie HTTP do własnej trasy aplikacji**
z ważnym ciasteczkiem sesji — i to jest to, co faza ma udowodnić.

## Detailed Findings

### 1. Tor zapisu — punkt wejścia i sekwencja

Dwóch pisarzy składu, oba **POST z natywnego formularza**, `application/x-www-form-urlencoded`,
jedno pole `composition` o wartości `JSON.stringify(...)`:

| Kierunek | Wejście                       | Handler                                                               | Nadawca                                                                      |
| -------- | ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| create   | `POST /api/teams`             | [api/teams/index.ts:29](src/pages/api/teams/index.ts#L29)             | [CompositionGate.tsx:48-56](src/components/team/CompositionGate.tsx#L48-L56) |
| update   | `POST /api/teams/[id]`        | [api/teams/[id].ts:33](src/pages/api/teams/[id].ts#L33)               | [CompositionGate.tsx:50](src/components/team/CompositionGate.tsx#L50)        |
| delete   | `POST /api/teams/[id]/delete` | [api/teams/[id]/delete.ts:42](src/pages/api/teams/[id]/delete.ts#L42) | nie czyta ciała w ogóle                                                      |

Ładunek: `[{"characterId":"vesper","perkIds":["vesper-breach-protocols"]}]`. Nazwa-hash i `user_id`
**nigdy** nie wchodzą do ciała żądania (FR-011). Nazwa pola to stała `COMPOSITION_FIELD`
([team-submission.ts:32](src/lib/team-submission.ts#L32)) importowana także przez wyspę
([CompositionGate.tsx:6](src/components/team/CompositionGate.tsx#L6)) — UI i serwer nie mają
osobnych kopii kontraktu.

Sekwencja `POST /api/teams` w kolejności ([index.ts](src/pages/api/teams/index.ts)):

1. `:32-35` — obecność `context.locals.user` (ustawiane w [middleware.ts:12](src/middleware.ts#L12)); obrona w głąb, realną barierą jest `isProtectedRoute()` z prefiksem `/api/teams` ([routes.ts:22](src/lib/routes.ts#L22))
2. `:37-40` — `createClient(...) !== null`
3. `:44-49` — `await request.formData()` w `try/catch`
4. `:50-52` — `typeof raw === "string"`
5. `:54-61` — `getCharacterPool(supabase)` w `try/catch`
6. `:63-69` — **`gateTeamSubmission(raw, pool)`** — jedyne miejsce egzekwowania reguły
7. `:71-73` — `createTeam(supabase, { userId, composition: gate.composition })` → INSERT

`POST /api/teams/[id]` powtarza tę sekwencję ([`[id].ts:51-88`](src/pages/api/teams/[id].ts#L51-L88))
z jednym dodatkiem: `encodeURIComponent(params.id)` na potrzeby celu redirectu
([`[id].ts:40`](src/pages/api/teams/[id].ts#L40)) — funkcja czysta i warta pokrycia. Format `id`
sprawdza dopiero repo przez `isTeamId` ([team-repo.ts:74-76](src/lib/team-repo.ts#L74-L76)), więc
nie-UUID daje `null`, nie błąd Postgresa `22P02`.

### 2. Reguła i limity — jedno wywołanie pokrywa oba ryzyka

`gateTeamSubmission(raw, pool)` ([team-submission.ts:133](src/lib/team-submission.ts#L133)) zwraca
`{ ok: true, composition } | { ok: false, reason: { kind: "invalid-payload" | "below-threshold" } }`.
Składa: limit rozmiaru ładunku **przed** `JSON.parse` (`MAX_COMPOSITION_PAYLOAD_BYTES = 1664`,
[:101](src/lib/team-submission.ts#L101), [:109-111](src/lib/team-submission.ts#L109-L111)),
`JSON.parse` w `try/catch`, kontrolę kształtu ze zdejmowaniem nadmiarowych pól
([:54-62](src/lib/team-submission.ts#L54-L62)), i wreszcie
`evaluateTeam(composition, pool).isValid` ([:140](src/lib/team-submission.ts#L140)).

`evaluateTeam` ([evaluate-team.ts:55](src/lib/domain/evaluate-team.ts#L55)) egzekwuje sześć naruszeń
plus próg:

| Reguła                          | Kotwica                                                                                                  | Ryzyko |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| próg 2 pkt × 7 kompetencji      | [:112-119](src/lib/domain/evaluate-team.ts#L112-L119)                                                    | #1     |
| max 6 członków                  | [:61-63](src/lib/domain/evaluate-team.ts#L61-L63)                                                        | #6     |
| brak powtórzeń postaci          | [:70-73](src/lib/domain/evaluate-team.ts#L70-L73)                                                        | #6     |
| max 2 perki na członka          | [:75-77](src/lib/domain/evaluate-team.ts#L75-L77)                                                        | #6     |
| ten sam perk dwa razy           | [:92-96](src/lib/domain/evaluate-team.ts#L92-L96)                                                        | #6     |
| nieznana postać / nieznany perk | [:81-84](src/lib/domain/evaluate-team.ts#L81-L84), [:100-103](src/lib/domain/evaluate-team.ts#L100-L103) | #6     |

`isValid = violations.length === 0 && meetsThreshold` ([:125](src/lib/domain/evaluate-team.ts#L125)).
Stałe reguły w [domain/types.ts:27-42](src/lib/domain/types.ts#L27-L42).

**Pułapka kontraktu do wyroczni testu**: `scores` odzwierciedla **surowy wybór**, także odrzucony
przez limity ([:24-33](src/lib/domain/evaluate-team.ts#L24-L33)) — 3. perk dolicza punkt, powtórzona
postać dolicza specjalizację dwa razy. Test toru zapisu, który wyprowadza oczekiwanie z `scores`
zamiast z `isValid`/`violations`, zmierzy nie to, co deklaruje.

**Limity są egzekwowane dwukrotnie, celowo**: `evaluateTeam` jako weryfikator i `roster.ts` jako
pisarz ([addMember:31](src/lib/domain/roster.ts#L31), [togglePerk:76](src/lib/domain/roster.ts#L76)).
Zgodność obu jest już związana testem — [roster.test.ts:245-397](src/lib/domain/roster.test.ts#L245-L397)
mapuje każde odrzucenie pisarza na odpowiadające naruszenie weryfikatora.

### 3. Kształt odmowy

Wyłącznie **HTTP 302 przez `context.redirect(...)` z `?error=<encodeURIComponent(msg)>`**. Zero JSON
w żądaniu i w odpowiedzi, żaden `throw` nie wychodzi z handlera.

- create — jedna fabryka: [index.ts:25-27](src/pages/api/teams/index.ts#L25-L27), cel `/teams/new?error=…`
- update — [`[id].ts:47`](src/pages/api/teams/[id].ts#L47), cel `/teams/<id>?error=…`
- brak sesji → `/auth/signin` ([index.ts:34](src/pages/api/teams/index.ts#L34), [`[id].ts:52`](src/pages/api/teams/[id].ts#L52))
- sukces: create → `/teams/<id>/embark` ([index.ts:73](src/pages/api/teams/index.ts#L73)); update → `/teams/<id>?saved=1` ([`[id].ts:99`](src/pages/api/teams/[id].ts#L99))

Komunikaty mają po jednej kopii w drzewie: `BELOW_THRESHOLD_MESSAGE`
([team-submission.ts:40](src/lib/team-submission.ts#L40)), `INVALID_PAYLOAD_MESSAGE`
([:43](src/lib/team-submission.ts#L43)), `SAVE_FAILED_MESSAGE` ([`[id].ts:31`](src/pages/api/teams/[id].ts#L31)).

**Zwinięcie wariantów**: wszystkie naruszenia limitów mapują się na `below-threshold`
([team-submission.ts:129-131](src/lib/team-submission.ts#L129-L131)), więc żądanie z siódmym członkiem
dostaje komunikat o progu kompetencji. Zamierzone, ale ma konsekwencję dla asercji: **test nie
odróżni po komunikacie ryzyka #1 od #6** — musi rozróżniać po tym, czy wiersz powstał, oraz
opcjonalnie po `violations` z `evaluateTeam` wywołanego wprost.

### 4. Czego nie widzi żaden test — luka, którą faza ma zamknąć

Zweryfikowane grepem: **żaden z 17 plików `*.test.ts` nie importuje niczego z `src/pages/`**
(jedyne trafienia to komentarze w `team-actions.test.ts:88` i `nav.test.ts:17-18`).

Niepokryte, uporządkowane wedle tego, co rozbraja barierę:

1. **Że trasa w ogóle woła bramkę.** Usunięcie `if (!gate.ok) return reject(...)` z
   [index.ts:65-69](src/pages/api/teams/index.ts#L65-L69) zostawia `npm test` w całości zielone.
   To jest wariant rozbrajający, którego czerwień jest jedynym sensownym kryterium sukcesu tej fazy.
2. **Kolejność kroków.** Nic nie broni przesunięcia `createTeam` przed bramkę.
3. **Glue trasy**: null-check klienta, `try/catch` wokół `formData()`, brak pola, złe `Content-Type`.
4. **Cele redirectów i mapowanie `reason.kind` → komunikat.**
5. **`createTeam` / `updateTeam` / `deleteTeam` / `getTeamDetail`** — z `team-repo.ts` testowany
   jest wyłącznie `isTeamId` ([team-repo.test.ts:3](src/lib/team-repo.test.ts#L3)), świadomie
   ([:5-9](src/lib/team-repo.test.ts#L5-L9)).

Do tego dwie luki wewnątrz warstwy już testowanej, tanie do domknięcia przy okazji:

- **`gateTeamSubmission` nie ma przypadku `duplicate-character`** — jedyny z sześciu limitów bez
  testu na torze zapisu (jest tylko na poziomie `evaluateTeam`).
- **`gateTeamSubmission` nie ma przypadku `unknown-perk`** (perk nienależący do postaci).

Marginalnie: kolejność `violations` jest zadeklarowana w kontrakcie
([evaluate-team.ts:37](src/lib/domain/evaluate-team.ts#L37)), ale wszystkie testy używają
`toContainEqual`, nigdy `toEqual` na całej tablicy — kolejność można zmienić bez czerwieni.

### 5. Baza danych nie egzekwuje reguły — i to jest decyzja, nie przeoczenie

Jedyne ograniczenie na `composition` to `check (jsonb_typeof(composition) = 'array')`
([20260905185700_teams_schema.sql:22](supabase/migrations/20260905185700_teams_schema.sql#L22)).
Baza przyjmie `[]`, `[1,2,3]`, 500 członków, powtórzone postacie, 5 perków. Brak triggerów, brak
FK do `characters`. Nagłówek migracji nazywa to wprost ([:6-8](supabase/migrations/20260905185700_teams_schema.sql#L6-L8)):
próg **nie** jest powtarzany w SQL, bo byłby drugą implementacją reguły bez testu w CI.

Baza egzekwuje wyłącznie **własność** (4 polityki RLS) i **niezmienność nazwy** (kolumnowy
`grant update (composition)`, [20260906090000_teams_update_policy.sql:27](supabase/migrations/20260906090000_teams_update_policy.sql#L27)).

Konsekwencja wiążąca dla fazy: **jedyną barierą progu i limitów jest Worker.** Nie ma drugiej
linii obrony, więc test tej bariery nie jest komfortem — jest jedynym, co ją trzyma.

### 6. Granica „poza interfejsem" — zweryfikowana, węższa niż brzmi

PRD Guardrail mówi „reguła obowiązuje także poza interfejsem", a archiwum S-03 przyjęło ryzyko
bezpośredniego zapisu przez PostgREST, „bo `SUPABASE_KEY` jest sekretem serwera i nie trafia
do przeglądarki". Sprawdzone na bieżącym kodzie i **założenie się trzyma**:

- [astro.config.mjs:28-29](astro.config.mjs#L28-L29) — oba sekrety `context: "server", access: "secret"`
- [supabase.ts:3](src/lib/supabase.ts#L3) — czytane wyłącznie z `astro:env/server`
- `grep` po `src/components/` i `src/layouts/` — **zero** trafień na `supabase` / `createClient`;
  klient istnieje tylko po stronie serwera, przeglądarka dostaje ciasteczka sesji, nie klucz

Czyli **realna powierzchnia ryzyk #1 i #6 to spreparowane żądanie HTTP do własnej trasy aplikacji**
z ważnym ciasteczkiem — `curl` z podmienionym `composition`, nie PostgREST. To dobra wiadomość dla
kosztu: dowód nie wymaga prawdziwego Postgresa, bo bariera, o którą chodzi, stoi przed bazą.

### 7. Opcje wykonania toru zapisu bez łamania reguły czystości

Reguła z `AGENTS.md`: „nic pod testem nie może importować `astro:*` ani `@/lib/supabase`".
Cztery opcje, wszystkie **przesondowane empirycznie** przez podagenta na kopii konfiguracji poza
repozytorium (vitest 4.1.11, astro 6.3.1):

| #   | Opcja                                                                                  | Wykonuje złożenie trasy?                                                  | Zgodność z literą reguły                                                                | Główny koszt                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | `vi.mock("@/lib/supabase")` w teście, zero zmian w konfiguracji                        | **tak** — sonda przeszła całą sekwencję do redirectu `/teams/new?error=…` | **nie** — plik pod testem importuje `@/lib/supabase`, choć w runtime nic się nie ładuje | spór o literę reguły; `vi.mock` na ścieżce jest kruche przy refaktorze                                                                                                |
| b   | `resolve.alias` dla `astro:env/server` w `vitest.config.ts`                            | tak                                                                       | nie                                                                                     | ładuje **prawdziwy** `supabase.ts`; stub trzeba napisać ręcznie i będzie cicho rozjeżdżał się ze schematem `env`; alias globalny dotyka wszystkich 17 czystych testów |
| c   | Czysty rdzeń handlera przyjmujący klienta argumentem + cienka trasa                    | częściowo — tylko to, co zjedzie do rdzenia                               | **tak, bez wyjątku**                                                                    | glue trasy zostaje niepokryty; trzeba ruszyć trzy trasy; **dziura przesuwa się o piętro** — nic nie zwiąże faktu, że cienka trasa woła rdzeń                          |
| d   | Osobny projekt Vitest (`test.projects`, `*.itest.ts`) z aliasem izolowanym do projektu | tak                                                                       | nie, ale w wydzielonej przegrodzie                                                      | `npm test` uruchamia oba projekty → zmiana udokumentowanego kontraktu z `AGENTS.md` i `ci.yml:21`                                                                     |

Fakty techniczne domykające obraz:

- **Astro nie daje gotowego mocka.** `astro/env/setup` eksportuje tylko `setGetEnv`, który podmienia
  _getter_ w `astro/env/runtime` — **nie materializuje** wirtualnego modułu `astro:env/server`.
  Generujący go `astro/dist/env/vite-plugin-env.js` **nie jest w mapie `exports`** paczki.
- **`test.alias` w Vitest 4 nie istnieje** — alias żyje wyłącznie w `resolve.alias`, globalnie
  albo per-projekt. `defineWorkspace` / `vitest.workspace.ts` zostały w v4 usunięte; jedyna droga
  do przegród to `test.projects` w `vitest.config.ts`.
- **Wzorzec wstrzykiwania jest przygotowany, ale nigdy nie użyty w teście.** `grep` po wszystkich
  17 plikach testowych daje **zero** trafień na `vi.mock`, `vi.fn`, `SupabaseClient`, `as unknown as`.
  Atrapy klienta trzeba dopiero napisać — nie ma wzorca do skopiowania.
- **Prawdziwy Postgres jest poza zasięgiem CI.** [ci.yml:21](.github/workflows/ci.yml#L21) woła
  gołe `npm test` bez `env:`, bez `services:`, bez Dockera; sekrety są przypięte wyłącznie do
  `npm run build` ([:22-25](.github/workflows/ci.yml#L22-L25)) i `AGENTS.md` nazywa to decyzją
  celową. Lokalny stos wymaga ręcznego `npx supabase start` (brak skryptu npm) i ~7 GB RAM.
  Dla Fazy 1 to i tak zbędne — patrz §6, bariera stoi przed bazą.

**Precedens interpretacyjny, który należy do tej decyzji**: repozytorium już raz rozstrzygnęło
tę regułę literalnie i wąsko. Dwa testy czytają pliki z dysku przez `node:fs`
([teams-policy-sql.test.ts:24-25](src/lib/teams-policy-sql.test.ts#L24-L25),
[character-pool-sql.test.ts:12-13](src/lib/domain/character-pool-sql.test.ts#L12-L13)), a ich
docstringi argumentują, że „to nie jest stos Supabase ani runtime Astro, więc mieści się w twardej
regule". Czyli działającą wykładnią jest: **liczy się, co się ładuje w runtime, nie skąd biorą się
dane.** Pod tą wykładnią opcja (a) mieści się w duchu reguły, choć nie w jej literze — i to jest
argument, który plan musi rozstrzygnąć jawnie, a nie przemilczeć.

## Code References

- `src/pages/api/teams/index.ts:29-79` — handler create; bramka w `:63-69`, INSERT w `:71-73`
- `src/pages/api/teams/[id].ts:33-104` — handler update; `encodeURIComponent` w `:40`, bramka w `:81-85`
- `src/pages/api/teams/[id]/delete.ts:42-72` — handler delete, nie czyta ciała
- `src/lib/team-submission.ts:133-145` — `gateTeamSubmission`, jedyna bramka toru zapisu
- `src/lib/team-submission.ts:101-119` — limit ładunku przed `JSON.parse`
- `src/lib/domain/evaluate-team.ts:55-129` — reguła progu i sześć naruszeń limitów
- `src/lib/domain/evaluate-team.ts:24-33` — kontrakt „surowe `scores`" (pułapka wyroczni)
- `src/lib/domain/types.ts:27-42` — stałe reguły
- `src/lib/team-repo.ts:83-91, 118-131` — `createTeam` / `updateTeam`, klient argumentem
- `src/lib/team-repo.test.ts:5-9` — świadome wyłączenie funkcji sięgających bazy
- `src/lib/supabase.ts:3` — jedyna nieczysta krawędź w drzewie importów trasy
- `astro.config.mjs:28-29` — `SUPABASE_KEY` jako sekret serwera
- `vitest.config.ts:5-11` — alias `@`, `include: ["src/**/*.test.ts"]`, brak `environment` i `setupFiles`
- `.github/workflows/ci.yml:18-25` — `npm test` bez sekretów, przed `build`
- `supabase/migrations/20260905185700_teams_schema.sql:6-8, 22` — decyzja „bez progu w SQL" i jedyny `check`

## Architecture Insights

- **Jedno źródło reguły, dwie powierzchnie.** Ta sama stała komunikatu i to samo pole formularza
  są importowane przez wyspę i przez trasę, a reguła liczona jest raz w `evaluateTeam`. Konsekwencja
  dla testu: nie wolno przepisywać oczekiwań z kodu trasy — wyrocznia musi pochodzić z Guardraila
  PRD („każda z 7 kompetencji ≥ 2 pkt", „max 6 członków", „max 2 perki", „bez powtórzeń"), inaczej
  test jest lustrem implementacji.
- **Trasa jako cienki klej** jest zadeklarowaną architekturą (S-03), ale nie jest związana żadnym
  automatem. „Cienki" jest dziś prawdą opisową, nie egzekwowaną.
- **Warstwy odmowy są rozłączne**: kształt (`invalid-payload`) i reguła (`below-threshold`) idą
  osobnymi ścieżkami do tej samej postaci `?error=`, ale wszystkie limity zwijają się do
  `below-threshold`. Test rozróżnia po **skutku w bazie**, nie po komunikacie.
- **Brak drugiej linii obrony jest świadomy i podwójnie podtrzymany** (S-03, S-05). To podnosi
  wagę tej fazy: nie dokłada ona redundancji, tylko pierwszy automat nad jedyną istniejącą barierą.

## Historical Context (from prior changes)

- `context/archive/2026-09-05-first-saved-team/plan-brief.md:33` — decyzja: próg egzekwowany
  w trasie API przez `evaluateTeam`, „duplikat w SQL nie miałby testu w CI".
- `context/archive/2026-09-05-first-saved-team/plan.md:121-125` — jawne odrzucenie progu w bazie;
  ryzyko PostgREST „przyjęte świadomie, bo `SUPABASE_KEY` jest sekretem serwera".
- `context/archive/2026-09-05-first-saved-team/plan-brief.md:76-77` — **warunek odwołania decyzji**:
  „gdyby klucz kiedykolwiek trafił do przeglądarki, decyzja «próg tylko w API» musi wrócić na stół".
  Sprawdzone dziś: klucz do przeglądarki nie trafia (§6).
- `context/archive/2026-09-05-first-saved-team/reviews/impl-review.md:32` — luka `perkIds: ["x","x"]`
  domykająca próg fałszywym punktem. **Zamknięta od tamtej pory** — zweryfikowane w bieżącym kodzie:
  [evaluate-team.ts:87-96](src/lib/domain/evaluate-team.ts#L87-L96) trzyma `seenPerkIds`, a komentarz
  cytuje wprost S-03 i `/api/teams`; test w [evaluate-team.test.ts:135](src/lib/domain/evaluate-team.test.ts#L135).
  Archiwum opisuje stan sprzed poprawki — nie przepisuj tej luki do planu jako otwartej.
- `context/archive/2026-09-06-edit-saved-team/plan.md:132-133` — edycja nie dostaje własnej kopii
  reguły, „dostaje tylko inny cel zapisu".
- `context/archive/2026-08-30-domain-rule-verification-harness/plan.md:46-51, 95-98` — **źródło reguły
  czystości testów**; uzasadnienie techniczne to dokładnie ta sama krawędź `astro:env/server`,
  którą dziś odblokowujemy. Reguła weszła do `AGENTS.md` commitem `891a1ec`.
- `context/archive/2026-08-30-solvable-character-pool/plan.md:69-71, 403-406` — **źródło wzorca
  „klient jako argument"**, z dwoma powodami: testowalność i null-check u wywołującego.
- `context/archive/2026-09-06-cross-account-team-isolation/plan.md:56-58` — „**Dowodu nie ma.**
  AGENTS.md wymusza czyste testy… izolacji cross-account nie da się zautomatyzować w Vitest".
  Ta faza kwestionuje właśnie tę tezę; jeśli którakolwiek z opcji (a)/(b)/(d) zostanie przyjęta,
  **Faza 2 przestaje być zablokowana** — dokładnie tak, jak zakłada uzasadnienie kolejności w §3
  test-planu.
- `context/archive/2026-09-06-cross-account-team-isolation/plan.md:133-135, 365` — obowiązkowa
  kontrola mutacyjna: „test, który nie czerwienieje po rozbrojeniu migracji, nie jest kotwicą,
  tylko dekoracją". Ta sama zasada wiąże tę fazę.
- **Czego w archiwum nie ma**: ani jednej próby, ani odrzuconego szkicu testu wykonującego handler
  `APIRoute`. Wykluczenie jest wszędzie deklaratywne („z definicji", „z konstrukcji"), nigdy
  poparte sondą. Sonda z §7 jest pierwszą — i pokazuje, że wykonanie jest technicznie trywialne,
  a problem jest wyłącznie normatywny.

## Related Research

- `context/foundation/test-plan.md` §2 (ryzyka #1, #6 i ich _Risk Response Guidance_), §4 (tabela
  stosu — wiersz „integration: none yet"), §6.2 (miejsce docelowe wzorca z tej fazy)
- `context/foundation/lessons.md` — pięć z siedmiu wpisów opisuje klasę „strażnik nie wiąże";
  szczególnie §„Strażnik, który jest zielony na commicie bazowym" i §„Strażnik musi mierzyć to,
  co deklaruje" wiążą kryteria weryfikacji tej fazy
- `context/archive/2026-08-30-domain-rule-verification-harness/` — fundament, który tę regułę ustanowił

## Open Questions

1. ~~**Normatywna:** czy przyjmujemy wykładnię „liczy się, co ładuje się w runtime"?~~
   **ROZSTRZYGNIĘTE 2026-09-07.** Tak. `AGENTS.md` → Hard rules przepisane: kryterium to
   ewaluacja w runtime testu, nie treść linii importu. Wprost dopuszczone: `import type`
   z `"astro"`, `node:fs`, oraz plik importujący `@/lib/supabase` pod testem, o ile test
   podmienia ten moduł przez `vi.mock`. Wprost zakazane: budowanie prawdziwego klienta
   w teście. Opcja (a) jest odtąd ścieżką zgodną z regułą; opcja (c) pozostaje dopuszczalna,
   ale nie jest już wymuszona przez regułę — wybór między nimi jest wyborem pokrycia, nie
   zgodności.
2. Jeśli opcja (c): co dokładnie zjeżdża do rdzenia? Same kroki 4-7 zostawiają niepokryte
   `locals.user`, null-check klienta i `try/catch` wokół `formData()` — czyli trzy z siedmiu
   kroków sekwencji. Czy rdzeń przyjmuje `FormData`, czy `Request`?
3. Czy faza obejmuje `[id].ts` i `[id]/delete.ts`, czy tylko `index.ts`? Za objęciem: `encodeURIComponent`
   w `[id].ts:40` jest czysty i nietrywialny, a S-05 świadomie dzieli bramkę z create. Przeciw:
   delete nie czyta ciała, więc dla ryzyk #1/#6 nie wnosi nic.
4. Czy przy okazji domykamy dwie luki `gateTeamSubmission` (`duplicate-character`, `unknown-perk`)?
   Koszt to dwa przypadki w istniejącym pliku, więc odpowiedź prawdopodobnie brzmi „tak" — ale to
   pokrycie warstwy już testowanej, nie nowa bariera, i nie wolno mu zastąpić testu toru.
5. Bramka `§5 Quality Gates` mówi „required after §3 Phase 1". Jeśli test trafi do osobnego projektu
   Vitest (opcja d), `ci.yml:21` musi się zmienić — czy to wchodzi w zakres tej fazy?
