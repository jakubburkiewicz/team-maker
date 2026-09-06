<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Usunięcie drużyny po potwierdzeniu w oknie dialogowym (S-06)

- **Plan**: context/changes/delete-team-confirmed/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny przegląd planu; commity 97f14d3, 76a1f23, 335a80a, 995394d)
- **Data**: 2026-09-06
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 4 ostrzeżenia, 3 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

Dowody bramek: `npx astro sync && npm run lint` czysto; `npm test` 12 plików / 134 testy zielone;
`npm run build` przechodzi (pod Node 22.14.0 z `.nvmrc` — domyślny Node 20 w powłoce jest odrzucany
przez Astro 6). Wszystkie zaplanowane pliki są w diffie i pokrywają się z umowami sygnatur, gałęzi,
komunikatów i miejsc renderowania; `alert-dialog.tsx` zweryfikowany przeciw rejestrowi shadcn jako
nietknięty poza wymaganymi importami. Osiem punktów „Czego NIE robimy" dotrzymanych. Jedyne EXTRA to
kosmetyka wewnątrz zaplanowanego komponentu (`Trash2`, `className` na `AlertDialogCancel`, `self-end`)
i dwa dodatkowe akapity docstringu w `delete.ts` — nie rozszerzają powierzchni funkcjonalnej.

## Ustalenia

### F1 — Drużyny „niespójnej z pulą" nie da się usunąć z interfejsu (wada planu)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/teams/[id].astro:103-122
- **Szczegóły**: Implementacja jest dosłownie zgodna z planem („wyspa żyje wyłącznie w gałęzi `composition !== null && pool !== null`"), ale sam plan nie rozróżnił trzech stanów tej drugiej gałęzi. Dla `notFound` i `teamFailed` ukrycie przycisku jest słuszne (US-04). Dla `inconsistent` (`:62,70`) wiersz **istnieje**, strona już zdradza jego istnienie nagłówkiem `Team <code>{team.name}</code>` (`:93`) i ekranem „This team no longer matches the character pool" (`:127`), a gracz nie ma jak go usunąć — wbrew US-03 i kryterium „wszystkie cztery operacje CRUD wykonalne z interfejsu". Usuwanie nie potrzebuje puli. Komentarz `:119-120` („nie ma czego usuwać") jest dla tej gałęzi nieprawdziwy. Stan jest dziś osiągalny tylko po zmianie danych puli (pula to stały seed), więc to luka warunkowa, nie regres.
- **Poprawka A ⭐ Zalecane**: Wynieś `<DeleteTeamDialog>` poza wyrażenie warunkowe i renderuj przy `team !== null` (czyli także w gałęzi `inconsistent` i przy przemijającej awarii puli); popraw komentarz tak, by nazywał `notFound`/`teamFailed` jako jedyne stany bez przycisku.
  - Siła: Domyka CRUD dla każdego istniejącego własnego wiersza; kilka linii w jednym pliku; `team.id`/`team.name` są już dostępne w tej gałęzi (`:86,93`).
  - Kompromis: Kryterium 3.10 („dokładnie dwie dyrektywy `client:load`") dalej trzyma; ale odmowa `throw` na drużynie niespójnej wraca z `?error=` na ekran, który nie ma slotu `<ServerError>` — komunikat pozostanie niewidoczny (ta sama klasa co udokumentowana w `delete.ts:30-33`).
  - Pewność: WYSOKA — gałąź i dane są na miejscu, zmiana jest lokalna.
  - Martwy punkt: Nie sprawdzono ręcznie ścieżki z drużyną niespójną (wymaga zmiany puli w bazie).
- **Poprawka B**: Zaakceptuj jako ryzyko i zapisz w follow-upach S-07/przyszłej zmiany puli
  - Siła: Zero kodu teraz; stan `inconsistent` nie występuje przy obecnym seedzie.
  - Kompromis: Pierwsza zmiana puli zostawi graczom rekordy nie do usunięcia z UI — wtedy trzeba będzie pamiętać o tym follow-upie.
  - Pewność: ŚREDNIA — zależy od tego, czy pula kiedykolwiek się zmieni.
  - Martwy punkt: Brak mechanizmu, który przypomni o tym follow-upie przy zmianie puli.
- **Decyzja**: FIXED via Fix A — `DeleteTeamDialog` wyniesiony za wyrażenie warunkowe pod strażnik `team !== null` (`[id].astro`), komentarz nazywa `notFound`/`teamFailed` jako jedyne stany bez przycisku; lint czysty, `client:load` nadal 2×.

### F2 — `params.id` z `%0A` wywraca handler na 500 (Location z nową linią)

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/teams/[id]/delete.ts:41
- **Szczegóły**: Astro dopasowuje trasę na `decodeURI(pathname)` (`node_modules/astro/dist/core/app/base.js:147`), więc `POST /api/teams/%0A/delete` daje `params.id === "\n"`. `reject()` wkłada surowe `id` do ścieżki, a `context.redirect` buduje `new Response(null, { headers: { Location } })` — zweryfikowane: `Headers.append: "/teams/\n?error=x" is an invalid header value`. Linia 50 jest poza `try`; w `catch` (`:71`) to samo `reject()` rzuca ponownie. Nieprzechwycony throw = 500 w Workerze, wbrew kontraktowi z docstringu (`:9-10`) i kryterium „żaden throw nie wychodzi z handlera". Osiągalne tylko przez zalogowanego użytkownika na własnej sesji; `decodeURI` nie dekoduje `%2F`/`%3F`/`%23`, prefiks `/teams/` jest stały — open redirect ani path traversal nie występują. Ten sam wzorzec siedzi w `src/pages/api/teams/[id].ts:37,44` (S-05, zarchiwizowane) — kandydat na lekcję.
- **Poprawka**: `const reject = (message) => \`/teams/${encodeURIComponent(id)}?error=…\`` (dla poprawnego UUID to identyczność) i to samo `encodeURIComponent(id)` w dwóch logach (`:61,70`, wstrzyknięcie nowej linii do logu). Bliźniaczą poprawkę w `[id].ts` zakolejkować jako follow-up.
- **Decyzja**: FIXED — `const id = encodeURIComponent(context.params.id ?? "")` przy deklaracji (pokrywa `reject` i oba logi); kryteria 2.5/2.7 dalej trzymają. Follow-up dla `[id].ts` w `follow-ups/review-fixes.md`.

### F3 — Brak blokady podwójnego submitu, którą ma bliźniaczy formularz

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/team/DeleteTeamDialog.tsx:74-82
- **Szczegóły**: `CompositionGate.tsx:42,51-53,60` po pierwszym kliknięciu ustawia `submitting` i daje `disabled`; tu przycisk „Delete team" zostaje aktywny do końca nawigacji. Dwa szybkie kliknięcia: pierwszy POST kasuje wiersz, drugi dostaje `null` z repo i odsyła na `/teams/<id>?error=…`, czyli na **goły 404** zamiast banera „Team deleted." Dane są poprawne, sygnał dla gracza — mylący.
- **Poprawka**: Powtórz wzorzec `CompositionGate`: `const [submitting, setSubmitting] = useState(false)`, `onSubmit={() => setSubmitting(true)}` na `<form>` (to nie jest `preventDefault` — kryterium 3.8 grepuje `onSubmit`, więc alternatywnie użyj `onClick` na przycisku), `disabled={submitting}` na obu przyciskach, etykieta „Deleting…".
- **Decyzja**: FIXED — `submitting` w `useState`, ustawiane w `onClick` przycisku submit (kryterium 3.8 nadal zielone: zero `onSubmit`/`fetch`), `disabled` na Cancel i submit, etykieta „Deleting…".

### F4 — Trzy kryteria automatyczne odhaczone `[x]`, choć ich litera nie przechodzi

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/changes/delete-team-confirmed/plan.md:545,547,592
- **Szczegóły**: Uruchomione dosłownie, komendy z planu zwracają trafienia: 1.7 (`grep -nE 'from "astro|@/lib/supabase' src/lib/team-repo.ts`) trafia w docstring `team-repo.ts:8` („bez importu `@/lib/supabase`"); 1.9 (`grep -rn "grant all\|grant.*truncate" supabase/migrations/`) trafia w komentarz `20260905090700_character_pool_revoke_writes.sql:4` („grant all on tables"); 3.11 (`grep -n "client:" src/pages/teams/index.astro`) trafia w komentarz `index.astro:29` („zero `client:*`"). Wszystkie trzy linie istniały **przed** tą zmianą, więc intencja każdego kryterium jest spełniona (brak importu, brak grantu, brak dyrektywy) — ale Progress podpisuje literę komendy hashem commitu, której komenda nie wykonała. Ironia: plan sam ostrzegał przy 1.9, że „grep biegnie po surowych plikach", i mimo to wybrał wzorzec trafiający w cudzy komentarz. Ta sama klasa pułapki, przed którą test SQL broni się helperem `allMigrationsWithoutComments()`.
- **Poprawka**: Nie ma nic do naprawy w kodzie. Zapisz jako lekcję: kryteria grepowe muszą być zakotwiczone na składni (`^import`, `grant\s`, `client:load`) albo strzyc komentarze przed dopasowaniem; a `[x]` w Progress znaczy „komenda wykonana i zielona", nie „intencja spełniona".
- **Decyzja**: FIXED + ACCEPTED-AS-RULE: „Kryteria grepowe kotwicz na składni, nie na słowach" (`lessons.md`). Komendy 1.7, 1.9, 3.11 w `plan.md` zakotwiczone (`^import`, `^\s*grant\s`, `client:[a-z]+[ />=]`) i sprawdzone — przechodzą dosłownie.

### F5 — Dokumentacja CSRF nazywa jedną z dwóch warstw obrony

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/pages/api/teams/[id]/delete.ts:16-18
- **Szczegóły**: Komentarz opiera brak tokena CSRF na `sameSite: "lax"` z `@supabase/ssr`. Drugą, niezależną warstwą jest domyślne `security.checkOrigin: true` Astro (`core/app/middlewares.js:17-31` — 403 dla każdego nie-GET z form-like `Content-Type` i obcym `Origin`). To ona ratuje wdrożenie na własnej domenie z subdomenami, gdzie „same-site" Lax nie wystarcza. Trasa eksportuje tylko `POST`, więc `<img>`/prefetch dostaje 404 i nic nie kasuje.
- **Poprawka**: Jedno zdanie w docstringu o `checkOrigin`, żeby ktoś, kto kiedyś wyłączy je w `astro.config.mjs`, zobaczył ostrzeżenie w tym pliku.
- **Decyzja**: FIXED — akapit o `security.checkOrigin` dopisany do docstringu `delete.ts`.

### F6 — Strażniki negatywne testu SQL przepuszczają `grant all`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/lib/teams-policy-sql.test.ts:76,110-111
- **Szczegóły**: `grant all on public.teams to authenticated` nadałby tabelowy update i truncate, a nie pasuje ani do `grant\s+update\s+on` (l. 76, sprzed tej zmiany), ani do wzorca `truncate` (wymaga literalnego słowa). Wzorzec dla `anon` działa. Kryterium 1.9 planu zakłada tę barierę, ale — jak w F4 — jego grep sam nie przechodzi.
- **Poprawka**: Jedna asercja `expect(sql).not.toMatch(/grant\s+all\b[^;]*public\.teams/i)` w bloku strażników.
- **Decyzja**: FIXED — asercja `grantsAllOnTeams` dodana, tytuł testu rozszerzony; test zielony, wzorzec sprawdzony na `grant all on public.teams to authenticated;`.

### F7 — Wyzwalacz okna to zwykły `Button`, nie `AlertDialogTrigger`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/team/DeleteTeamDialog.tsx:47-57
- **Szczegóły**: Otwieranie stanem (`onClick={() => setOpen(true)}`) jest spójne z `TeamComposer.tsx:53-60`, ale gubi `aria-haspopup`/`aria-expanded`/`aria-controls`, które `AlertDialogTrigger asChild` dałby za darmo. WCAG jest Non-Goalem PRD, a reszta dostępności jest w porządku (Title + Description obecne, Escape zamyka, Radix focusuje Cancel przy otwarciu, klik w tło zablokowany).
- **Poprawka**: `<AlertDialogTrigger asChild><Button …>` zamiast ręcznego `onClick`; `useState` zostaje dla `open`/`onOpenChange`.
- **Decyzja**: SKIPPED — WCAG to Non-Goal PRD, wzorzec spójny z `TeamComposer`.
