<!-- IMPL-REVIEW-REPORT -->

# Przegląd implementacji: Zapis domkniętej drużyny z potwierdzeniem (S-03)

- **Plan**: context/changes/first-saved-team/plan.md
- **Zakres**: Faza 4 z 4 (pełny przegląd planu)
- **Data**: 2026-09-05
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar                  | Werdykt                                |
| ----------------------- | -------------------------------------- |
| Zgodność z planem       | PASS (1 obserwacja — uzasadniony dryf) |
| Dyscyplina zakresu      | PASS                                   |
| Bezpieczeństwo i jakość | WARNING                                |
| Architektura            | PASS                                   |
| Spójność wzorców        | PASS (1 obserwacja)                    |
| Kryteria sukcesu        | WARNING                                |

Weryfikacja automatyczna (Node 22.14.0): `npx astro sync` ✅, `npm run lint` ✅ (0 błędów), `npm test` ✅ (10 plików, 115 testów), `npm run build` ✅, grep na `lib/supabase` w testach pusty, grep na `astro:`/`@/lib/supabase` w `team-submission.ts`/`team-repo.ts` pusty, `fetch(` w `EmbarkGate.tsx` = 0, `package.json`/lock nietknięte. Kontrola mutacyjna 2.9 powtórzona: podmiana `isValid` → `violations.length` czerwieni 2 testy, drzewo przywrócone.

## Ustalenia

### F1 — Zduplikowany `perkId` liczy się podwójnie i omija próg poza interfejsem

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/domain/evaluate-team.ts:87-96, src/lib/team-submission.ts:26-34
- **Szczegóły**: `evaluateTeam` deduplikuje postacie (`seenCharacterIds`), ale nie perki — każde wystąpienie tego samego `perkId` w `perkIds` dolicza `PERK_POINTS`, a przy `perkIds.length <= 2` nie ma żadnego naruszenia. Parser w `team-submission.ts` przepuszcza powtórzenia (docstring „limitów nie sprawdza — robi to `evaluateTeam`" jest tu fałszywy). Potwierdzone uruchomieniem na prawdziwej puli: `{ characterId: "wren", perkIds: ["wren-clinic-contacts", "wren-clinic-contacts"] }` daje `medicine: 3`, `violations: []`, `isValid: true`, a `gateTeamSubmission` zwraca `ok` ze zduplikowanym składem idącym do bazy. Spreparowany `POST /api/teams` utrwala skład, który realnie ma 1 punkt w kompetencji — Guardrail PRD „zapisana drużyna zawsze spełnia próg, reguła obowiązuje także poza interfejsem" jest obchodzony. Przed S-03 nieosiągalne (skład budował tylko `roster.ts`); S-03 po raz pierwszy podaje `evaluateTeam` nieufne wejście, a plan (§Faza 2 pkt 1) sam założył, że reguła domyka limity. Wymaga logowania i szkodzi tylko własnym danym gracza, stąd nie CRITICAL. Brak testu na `["p", "p"]`.
- **Poprawka A ⭐ Zalecane**: Dodać naruszenie `duplicate-perk` do `RuleViolation` w `evaluateTeam` (zbiór widzianych perków w pętli członka, symetrycznie do `duplicate-character`) + test w `team-submission.test.ts` i `evaluate-team.test.ts`.
  - Siła: Reguła zostaje w jednym miejscu; S-05 wczytujący skład z bazy i wykres nie policzą podwójnie; spójne z istniejącym `duplicate-character`.
  - Kompromis: Dotyka modułu domenowego z S-02 i rozszerza typ unii `RuleViolation` (konsumenci `violations` w wyspie mogą wymagać obsługi nowego `kind`).
  - Pewność: WYSOKA — identyczny wzorzec `seenCharacterIds` już w tej samej funkcji.
  - Martwy punkt: Nie sprawdzono, czy jakiś komponent renderuje `violations` per `kind` z wyczerpującym `switch`.
- **Poprawka B**: Odrzucać powtórzenia w `toMemberSelection` (`new Set(perkIds).size !== perkIds.length → null`, czyli `invalid-payload`) + test parsera.
  - Siła: Zmiana w 3 liniach, wyłącznie w warstwie I/O, bez dotykania domeny.
  - Kompromis: Reguła w dwóch miejscach; S-05 czytający z bazy nadal nie ma ochrony w `evaluateTeam`; docstring parsera trzeba przepisać.
  - Pewność: WYSOKA — parser już rozstrzyga kształt wejścia.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED via Fix A — `duplicate-perk` w `evaluateTeam` (`seenPerkIds`), testy w `evaluate-team.test.ts` (rook-nav ×2 domyka sumy, `isValid: false`) i `team-submission.test.ts` (perk ×2 → `below-threshold`); oba czerwone bez poprawki.

### F2 — `useFormStatus().pending` nigdy nie jest `true` przy natywnym `action` URL

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność) + Kryteria sukcesu
- **Lokalizacja**: src/components/team/EmbarkGate.tsx:22-31, 34-39; src/components/auth/SubmitButton.tsx:12
- **Szczegóły**: `react-dom-client` (`node_modules/react-dom/cjs/react-dom-client.development.js:19084-19105`) wywołuje `startHostTransition` wyłącznie gdy `"function" === typeof action`. Dla `<form method="POST" action="/api/teams">` przeglądarka wysyła natywnie, React nic nie rejestruje, `pending === false` na stałe. Skutki: (1) „Embarking…" i `disabled` przy `pending` to martwy kod; (2) brak ochrony przed podwójnym wysłaniem — dwuklik na wolnym łączu to dwa `POST` i dwie drużyny; (3) docstring „`useFormStatus` za darmo" (i plan §Kluczowe odkrycia, §Faza 3 pkt 1) wprowadza w błąd. Ten sam błąd siedzi w istniejącym `SubmitButton.tsx` — nowy plik wiernie skopiował wadliwy wzorzec. **Sygnał o weryfikacji ręcznej**: kryterium 3.6 w §Postęp jest odhaczone z treścią „klik → przycisk pokazuje „Embarking…"", czego nie da się zaobserwować — to podpisanie na ślepo.
- **Poprawka A ⭐ Zalecane**: `onSubmit` w `EmbarkGate` ustawiający lokalny `useState` `submitting` (bez `preventDefault`), przycisk `disabled={!ready || submitting}` z etykietą „Embarking…"; usunąć `useFormStatus`; poprawić docstring. Nie koliduje z decyzją planu „bez `onSubmit`" — tamta dotyczyła bramki `!ready`, nie stanu wysyłki.
  - Siła: Realna blokada dwukliku i realny wskaźnik wysyłki; formularz nadal natywny (bez `fetch`).
  - Kompromis: Wyspa zyskuje jeden bit stanu; `SubmitButton` w `auth/` pozostaje z tym samym błędem, chyba że poprawisz oba.
  - Pewność: WYSOKA — natywne `submit` przechodzi, a `onSubmit` odpala się przed nawigacją.
  - Martwy punkt: Zachowanie po „wstecz" z bfcache (przycisk może zostać w stanie `submitting`) — nieweryfikowane.
- **Poprawka B**: Usunąć `useFormStatus` i gałąź `pending`, zostawić `disabled={!ready}`, poprawić docstring; ryzyko dwukliku przyjąć świadomie (dwie drużyny to nadmiar, nie utrata danych).
  - Siła: Usuwa martwy kod i kłamiący komentarz bez dodawania stanu.
  - Kompromis: Brak wskaźnika wysyłki i brak ochrony przed dwukrotnym zapisem.
  - Pewność: WYSOKA — czysta redukcja.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED via Fix A — `EmbarkGate` z lokalnym `useState` `submitting` ustawianym w `onSubmit` (bez `preventDefault`), `useFormStatus` usunięty, docstring przepisany. `SubmitButton.tsx` w `auth/` celowo nietknięty (poza zakresem; kandydat na lekcję).

### F3 — Wartownik migracji ma dwie szczeliny

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/team-schema.test.ts:40, 54-61
- **Szczegóły**: (1) Polityka `to authenticated, anon` przeszłaby oba testy (zawiera `to authenticated`, nie zawiera literału `to anon`). (2) `latestMigration("_teams_schema.sql")` ogląda tylko pliki z tym sufiksem — polityki `update`/`delete` z S-05/S-06 trafią do migracji o innym sufiksie i będą poza zasięgiem tripwire'a, którego sens to „`teams` nigdy nie dostaje polityki dla `anon`".
- **Poprawka**: Skanować wszystkie migracje, zbierać `create policy … on public.teams` i asertować, że lista ról to dokładnie `authenticated` (np. regex `/\bto authenticated\b(?!\s*,)/`).
- **Decyzja**: FIXED — `allStatements()` + `policyRoles()` w `team-schema.test.ts`; asercja na dokładną listę ról i na `\bto\b…\banon\b` we wszystkich poleceniach dotyczących `public.teams`. Sonda z `to authenticated, anon` w osobnym pliku czerwieni 2 testy.

### F4 — Nadmiarowy indeks `teams_user_id_idx`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Wydajność)
- **Lokalizacja**: supabase/migrations/20260905185700_teams_schema.sql:27
- **Szczegóły**: `unique (user_id, name)` tworzy indeks złożony z `user_id` jako kolumną wiodącą, którego planner używa do filtrowania po samym `user_id` (RLS, lista S-04). Osobny indeks to koszt zapisu bez zysku odczytu. Wada planu (SQL z umowy), nie implementacji. Migracja jest już na produkcji — usunięcie to nowa migracja `drop index`.
- **Poprawka**: Pominąć (koszt pomijalny przy tej skali) albo dołożyć `drop index` do migracji S-05/S-06.
- **Decyzja**: SKIPPED — koszt pomijalny przy tej skali; nie warto osobnej migracji.

### F5 — `formData()` może rzucić i wyjść z handlera jako 500

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (Niezawodność)
- **Lokalizacja**: src/pages/api/teams/index.ts:35
- **Szczegóły**: `await context.request.formData()` rzuca `TypeError` dla ciała o `Content-Type` innym niż `multipart/form-data` / `application/x-www-form-urlencoded` (spreparowane żądanie zalogowanego użytkownika). Wychodzi z handlera jako 500 — wbrew docstringowi „żaden `throw` nie wychodzi z handlera" (l. 12). Identyczny stan w `signin.ts:5` — wzorzec repo.
- **Poprawka**: Owinąć `formData()` w `try/catch` → `?error=Invalid team payload`.
- **Decyzja**: FIXED — `try/catch` wokół `formData()` w `/api/teams`; `signin.ts` nietknięty (poza zakresem).

### F6 — 404 w `embark.astro` przez `Astro.response.status` zamiast `return new Response`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/pages/teams/[id]/embark.astro:9-12, 32-40
- **Szczegóły**: Umowa mówiła `return new Response(null, { status: 404 })`. Implementacja ustawia `Astro.response.status = 404` i renderuje pustą gałąź. Zweryfikowane sondą pod-agenta: top-level `return` w `.astro` wywraca `@typescript-eslint/no-misused-promises` („Expected node to have a parent") i `npm run lint` pada. Plan był tu niewykonalny w literze; intencja (gołe 404 dla brakującego klienta, nieznanego i cudzego id, nie-UUID) zachowana, komentarz w pliku to tłumaczy. Wzorzec wróci w S-04/S-07.
- **Poprawka**: Zapisać jako lekcję („404 w `.astro` bez top-level `return` — lint crashuje") albo pominąć.
- **Decyzja**: ACCEPTED-AS-RULE: „W `.astro` nie planuj top-level `return` — 404 przez `Astro.response.status`, redirect przez middleware" (`context/foundation/lessons.md`; sonda potwierdziła, że `return Astro.redirect(...)` crashuje tak samo). Kod bez zmian — już zgodny.

### F7 — Faza 4: zdalny stan nie zgadzał się z planem, push wykonano mimo „wstrzymaj do wyjaśnienia"

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/deployment/deploy-plan.md:152-156
- **Szczegóły**: Plan §Faza 4 krok 2 zakładał, że `revoke_writes` jest wyłącznie lokalna, a „każdy inny obraz oznacza dryf schematu i wstrzymuje push do wyjaśnienia". `migration list` pokazał ją już zdalnie. Dryf został uczciwie odnotowany i potwierdzony sondą `42501`, ale przyczyna wcześniejszego, nieudokumentowanego pushu nie została ustalona. Ryzyko zerowe (migracja addytywna, skutek zweryfikowany); sygnał o dyscyplinie dokumentu wdrożeniowego — ta sama klasa co F1 z przeglądu F-01, tym razem wykryta, nie wyprodukowana.
- **Poprawka**: Dopisać w `deploy-plan.md` jedno zdanie o prawdopodobnej przyczynie (albo „nieustalona") — lub pominąć.
- **Decyzja**: FIXED — `deploy-plan.md` dostał akapit „Przyczyna dryfu nieustalona" z oknem czasowym zawężonym z historii git (`3ff6521` 09:15 → Faza 4 19:40) i regułą: wynik `migration list` trafia do dokumentu w tym samym commicie co `db push`.
