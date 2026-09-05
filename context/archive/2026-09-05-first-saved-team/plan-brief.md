# Zapis domkniętej drużyny z potwierdzeniem (S-03) — Krótki plan

> Pełny plan: `context/changes/first-saved-team/plan.md`

## Co i dlaczego

Gwiazda przewodnia roadmapy: przycisk „Embark on the job" ma trwale zapisać skład spełniający próg
pod automatycznie wygenerowaną nazwą-hashem i pokazać potwierdzenie zapisu, a dopiero potem „Work
in Progress" (FR-007, FR-011, FR-018, FR-019). Dopóki to nie działa, reszta pętli CRUD (S-04 – S-07)
nie ma nad czym pracować — a Guardrail „zapisana drużyna zawsze spełnia próg, także poza interfejsem"
pozostaje nieudowodniony, bo nie ma ścieżki zapisu, którą można by obejść.

## Punkt wyjścia

S-02 dostarczyło bramkę bez handlera: `EmbarkGate` odblokowuje się przy `evaluation.isValid`,
a skład żyje wyłącznie w pamięci wyspy `TeamComposer`. Reguła (`evaluateTeam`) i pula w bazie
(`getCharacterPool`) są gotowe; warsztat migracji + RLS istnieje po F-02, projekt jest zlinkowany,
a jedna migracja z F-02 czeka na `db push`. `PROTECTED_ROUTES` nie obejmuje `/api/teams`.

## Pożądany stan końcowy

Gracz domyka próg, klika „Embark", ląduje na `/teams/<uuid>/embark` z „Team A3F9C0D1 is saved"
(nazwa odczytana z bazy, nie z adresu), blokiem „Work in Progress" i linkami dalej. W `teams` jest
jeden wiersz z jego `user_id` i składem w `jsonb`. Drugie konto dostaje 404. Skład poniżej progu
wysłany `curl`-em z ominięciem interfejsu wraca z `?error=` i niczego nie zapisuje — dowód
w `npm test`.

## Kluczowe podjęte decyzje

| Decyzja                     | Wybór                                                                 | Dlaczego (1 zdanie)                                                                                                        |
| --------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Schemat                     | Jedna tabela `teams`, skład w `jsonb`                                 | Zapis i edycja (S-05) to jeden wiersz — atomowe bez RPC; PostgREST nie ma transakcji między tabelami.                       |
| Egzekwowanie progu          | Trasa API przez `evaluateTeam` na puli z bazy + RLS na własność       | Jedno źródło reguły (F-01) wspólne dla ekranu i zapisu; duplikat w SQL nie miałby testu w CI.                              |
| Ryzyko PostgREST            | Przyjęte świadomie                                                    | `SUPABASE_KEY` jest sekretem serwera (`astro:env/server`) — nie ma ścieżki z przeglądarki.                                  |
| Nazwa-hash                  | Losowa, `default` kolumny (8 hex z `gen_random_uuid()`), `unique(user_id, name)` | Powstaje przy każdym pisarzu; S-05 nic nie musi zachowywać; kolizja 1/4 mld = błąd ogólny.                      |
| Transport                   | Natywny `<form method="POST">` z ukrytym polem JSON                   | Konwencja repo (`SignInForm`, `?error=`), `useFormStatus` za darmo; utrata składu przy awarii zapisu przyjęta.              |
| Potwierdzenie               | Osobna strona `/teams/[id]/embark` czytająca nazwę z bazy             | Nazwa z bazy jest dowodem trwałości, nie echem; ścieżka stabilna dla S-04/S-05.                                            |
| Nieznane / cudze id         | Gołe 404, prowizorycznie                                              | Nie ujawnia istnienia cudzego rekordu; S-07 rozstrzyga docelowo i dokłada nawigację.                                        |
| Wdrożenie                   | `supabase db push` jako ostatnia, ręczna faza                         | Gwiazda przewodnia jest dowieziona dopiero na produkcji; wzorzec fazy z F-02.                                              |

## Zakres

**W zakresie:** migracja `teams` (RLS `insert`/`select`, `revoke` dla `anon`) z testem-wartownikiem;
czysty moduł `team-submission.ts` (parser + bramka) z testami; `team-repo.ts` (`createTeam`,
`getTeamSummary`); `POST /api/teams` w kształcie `signin.ts`; `/api/teams` w `PROTECTED_ROUTES`;
`EmbarkGate` jako formularz; `?error=` na `/teams/new`; strona `/teams/[id]/embark`; notatki
w roadmapie (S-03, S-07); `db push` + `deploy-plan.md`.

**Poza zakresem:** lista, szczegóły, stan pusty (S-04); edycja, usuwanie i ich polityki RLS
(S-05, S-06); dowód izolacji na czterech operacjach (S-07); próg w SQL; `fetch`/JSON; normalizacja
składu i FK do `characters`; nazwa z treści; strona 404 z nawigacją; `gen types`, `zod`, nowe
zależności; automatyczny deploy; testy komponentów/tras.

## Architektura / Podejście

`TeamComposer` → `EmbarkGate` (`<form>` + `<input hidden name="composition">`) → `POST /api/teams`
→ `gateTeamSubmission(raw, pool)` (czysty: parser + `evaluateTeam`) → `createTeam(supabase, …)`
→ redirect `/teams/<id>/embark` → `getTeamSummary` (RLS) → strona potwierdzenia. Błędy każdej
warstwy mapują się na `/teams/new?error=…`; `throw` z repo nigdy nie wychodzi z handlera.

## Fazy w skrócie

| Faza                              | Co dostarcza                                                          | Kluczowe ryzyko                                                                       |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Schemat `teams` w bazie        | Migracja z RLS na właściciela, wartownik, kontrola na dwóch kontach   | Polityka `select` musi wjechać razem z `insert` — inaczej `returning` zawodzi po zapisie |
| 2. Bramka zapisu poza interfejsem | `team-submission.ts` + testy, `team-repo.ts`, `POST /api/teams`, middleware | Bramka musi wiązać się z `isValid`, nie tylko z brakiem naruszeń (test mutacyjny)   |
| 3. Wyspa i strona potwierdzenia   | Formularz w `EmbarkGate`, `?error=` na `/teams/new`, `/teams/[id]/embark` | Nie-UUID w adresie → 404, nie stan awarii                                              |
| 4. Wdrożenie na projekt hostowany | `db push` (z czekającą migracją F-02), deploy workera, `deploy-plan.md` | Kolejność migracja → worker; pierwsza zmiana schematu po wdrożeniu                     |

**Wymagania wstępne:** S-02 zarchiwizowane (jest); stos lokalny `supabase start` z dwoma kontami
testowymi; dostęp do zlinkowanego projektu hostowanego i `wrangler` (Faza 4).
**Szacowany wysiłek:** ~2 sesje w 4 fazach (Faza 4 to kroki operacyjne, nie kod).

## Otwarte ryzyka i założenia

- Bezpośredni zapis przez PostgREST omija próg — przyjęte, bo klucz jest sekretem serwera; gdyby
  klucz kiedykolwiek trafił do przeglądarki, decyzja „próg tylko w API" musi wrócić na stół.
- Awaria zapisu zeruje skład (natywny formularz + przeładowanie) — przyjęte; dotyczy tylko awarii,
  bo odrzucenie progu jest z interfejsu nieosiągalne.
- `unique(user_id, name)` bez ponowienia przy kolizji — akceptowalne przy tej skali.
- Migracja addytywna, ale pierwsza po wdrożeniu — wersja workera sprzed pusha zapisana ręcznie.

## Kryteria sukcesu (podsumowanie)

- Recenzent domyka próg, klika „Embark" i widzi potwierdzenie zapisu z nazwą-hashem przed „Work in
  Progress"; wiersz istnieje w bazie z jego `user_id`.
- `npm test` dowodzi, że bramka serwerowa odrzuca każdy skład bez `isValid` i każde wejście
  o złym kształcie; migracja nie może stracić RLS bez czerwonego testu.
- Drugie konto nie widzi drużyny ani przez stronę (404), ani przez PostgREST; to samo na produkcji.
