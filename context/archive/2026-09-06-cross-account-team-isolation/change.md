---
change_id: cross-account-team-isolation
title: Cudza drużyna jest niedostępna każdą ścieżką
status: archived
created: 2026-09-06
updated: 2026-09-06
archived_at: 2026-09-06T12:30:07Z
---

## Notes

- Element mapy drogowej: **S-07** w `context/foundation/roadmap.md` (kamień milowy M-1, strumień B —
  pętla CRUD nad zapisaną drużyną). Ostatni fragment domykający Guardrail „izolacja danych między
  kontami” oraz wymaganie pozafunkcjonalne „liczba drużyn cudzego konta widocznych lub
  modyfikowalnych wynosi zero”.
- Wymagania wstępne: S-05 (`edit-saved-team`) i S-06 (`delete-team-confirmed`), oba zarchiwizowane
  2026-09-06. Dopiero po nich istnieją wszystkie cztery operacje CRUD, na których da się wykazać zero.
- Odnośniki PRD: US-04, FR-004, Guardrail „izolacja danych między kontami”, wymaganie
  pozafunkcjonalne o własności binarnej.
- **Punkt wyjścia jest nietypowy: mechanizm izolacji już stoi kompletny.** RLS pokrywa wszystkie
  cztery operacje (`owner can insert/read/update/delete teams`), repo zwraca `null`
  nierozróżnialnie dla nieznanego id, cudzego wiersza i nie-UUID, a trasy API nie różnicują
  komunikatu. Ten fragment nie buduje izolacji — rozstrzyga, dowodzi i zakotwicza.
- Domyka zobowiązania zapisane imiennie do S-07 w trzech miejscach:
  - `context/archive/2026-09-05-first-saved-team/plan-brief.md:38` i
    `src/pages/teams/[id]/embark.astro:23` — „gołe 404 prowizorycznie; S-07 rozstrzyga docelowo
    (404 vs redirect) i dokłada nawigację”.
  - `context/archive/2026-09-06-delete-team-confirmed/follow-ups/review-fixes.md` (F2) —
    `encodeURIComponent` w `src/pages/api/teams/[id].ts`.
  - `context/archive/2026-09-06-own-teams-list-and-detail/follow-ups/review-fixes.md` (F8) —
    potwierdzenie, że produkcyjny `SUPABASE_KEY` nie omija RLS.
- Wiążące lekcje z `context/foundation/lessons.md`:
  - §„W `.astro` nie planuj top-level `return`” — wymienia S-07 wprost.
  - §„Kryteria grepowe kotwicz na składni, nie na słowach”.
- Decyzje projektowe z sesji planowania 2026-09-06:
  - **404 z pełną stroną**, nie redirect na listę. `Astro.response.status = 404` zostaje;
    zmienia się wyłącznie ciało odpowiedzi z pustego na ekran z nawigacją.
  - **Wspólny komponent `src/components/team/TeamNotFound.astro`** renderujący własny `Layout`,
    żeby obie trasy dawały odpowiedź identyczną co do tytułu, treści i nawigacji.
  - **Komunikat wprost i łącznie**: „This team does not exist, or it is not yours.” — nazywa
    regułę izolacji dla persony recenzenta, nie ujawniając, który z przypadków zaszedł.
  - **RLS zostaje jedyną barierą.** Żadnego `.eq("user_id", …)` w repo: filtr w kodzie maskowałby
    awarię polityki i uczyniłby dowód dwukontowy nierozstrzygającym.
  - **Dowód biegnie na produkcji**, nie lokalnie — zielony przebieg empirycznie wyklucza klucz
    `sb_secret_` i tym samym pochłania F8.
  - **Testy SQL domykają macierz czterech operacji** plus strażnicy negatywni na
    `disable row level security` i `drop policy`.
- **Pochodzenie dowodu Fazy 3 (2026-09-06).** Kroki 3.1 i 3.2 wykonane i zaobserwowane w sesji
  implementacyjnej: pełny łańcuch CI zielony, `npx wrangler deploy` zakończony (Version ID
  `a6fc4019-0f4e-4dea-98ad-3895ab7be2e5`, `https://team-maker.jakub-e9b.workers.dev`), smoke-test
  curl-em potwierdził, że `/teams` i `/teams/<uuid>` bez sesji dają 302 na `/auth/signin`.
  Kroki 3.3-3.11 — macierz dwukontowa — wykonał **operator**, nie agent: wymagają dwóch skrzynek
  pocztowych i dwóch sesji przeglądarkowych. Agent dostarczył ładunki dla 3.7/3.8 (fetch
  z `credentials: "include"` i formularzowym `Content-Type`, z konsoli otwartej na origin aplikacji)
  wraz z tabelą rozróżniającą trzy bariery po `status` i `url`. Odhaczenie opiera się na
  potwierdzeniu operatora; **kody odpowiedzi HTTP nie zostały przechwycone w transkrypcie sesji**,
  wbrew Umowie kroku 2 Fazy 3. Kto będzie to audytował, ma tu jedyny ślad.
- Nie wymaga migracji bazy: polityki są komplet od S-06, a zmiana asercji w teście nie dotyka
  `supabase/`.
- Przegląd planu 2026-09-06 (`/10x-plan-review`, tryb głęboki): werdykt DO POPRAWY → SOLIDNY
  po poprawkach. Cztery ustalenia, wszystkie naprawione w `plan.md`, raport nie zapisany osobno:
  - F1 (krytyczne) — kontrola mutacyjna 2.6 kazała **zakomentować** `enable row level security`,
    a asercje pozytywne biegną po surowym tekście migracji (`latestMigration`), więc test zostałby
    zielony. Krok zmieniony na **usunięcie** linii, spójnie z 2.7.
  - F2 (krytyczne) — obok pułapki `checkOrigin` (403 przed RLS) stoi druga, symetryczna:
    `gateTeamSubmission` odrzuca ładunek przed `updateTeam`, też bez 403. Kroki 3.7/3.8 notują teraz
    komunikat z nagłówka `Location`, nie sam kod odpowiedzi.
  - F3 (ostrzeżenie) — macierz obejmuje trzy operacje × dwie ścieżki, nie cztery: bariery `insert`
    nie da się z aplikacji naruszyć (`user_id` z sesji), więc dowodzi jej wyłącznie test SQL z Fazy 2.
    Krok 3.9 przemianowany na to, czym jest.
  - F4 (ostrzeżenie) — strażnik `drop policy` kolidował z zapisaną w planie ścieżką naprawczą
    („nowa migracja"); furtka (`alter policy`) nazwana wprost w umowie strażnika.
