<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Usunięcie drużyny po potwierdzeniu w oknie dialogowym (S-06)

- **Plan**: `context/changes/delete-team-confirmed/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-06
- **Werdykt**: DO POPRAWY → SOLIDNY (po sortowaniu: 5/5 ustaleń naprawionych 2026-09-06)
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność ze stanem końcowym | OSTRZEŻENIE |
| Oszczędne wykonanie | ZALICZONY |
| Dopasowanie architektoniczne | OSTRZEŻENIE |
| Martwe punkty | OSTRZEŻENIE |
| Kompletność planu | OSTRZEŻENIE |

## Ugruntowanie

7/7 ścieżek ✓ (`team-repo.ts`, `teams-policy-sql.test.ts`, `api/teams/[id].ts`, `teams/[id].astro`,
`teams/index.astro`, `MemberPickerDialog.tsx`, `middleware.ts`; trzy nowe pliki poprawnie nieobecne),
6/6 symboli ✓ (`updateTeam:117`, `isTeamId:73`, `SAVE_FAILED_MESSAGE:31`, `<ServerError>:113`,
`<TeamComposer … client:load>:115`, `<Fragment>:72` w `index.astro` — wszystkie odnośniki plik:linia
trafiają co do linii), brief↔plan ✓, Progress↔Fazy ✓ (3 fazy, 32 punkty, 1:1 z kryteriami sukcesu).

## Ustalenia

### F1 — `AlertDialogAction` zamyka okno, zanim przeglądarka wyśle formularz

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3, pkt 2 (`DeleteTeamDialog.tsx`) + §Krytyczne szczegóły implementacji
- **Szczegóły**: Plan nazywa jedną cichą awarię przycisku potwierdzenia (formularz poza portalem
  Radiksa) i rozbraja ją; druga, tej samej klasy, zostaje nienazwana. `AlertDialogAction` jest
  zbudowany na `DialogPrimitive.Close` (`@radix-ui/react-alert-dialog@1.1.23/dist/index.mjs:81-86`),
  a `DialogClose` ma bezwarunkowe `onClick: () => context.onOpenChange(false)`
  (`node_modules/@radix-ui/react-dialog/dist/index.mjs:272-286`). Treść okna jest pod `Presence`
  (`:134`). Klik zamyka okno w tym samym zdarzeniu, w którym przeglądarka miałaby uruchomić submit;
  odłączony przycisk nie ma właściciela formularza i POST nie wychodzi — bez błędu. Ratuje to
  wyłącznie animacja wyjścia (`react-presence/dist/index.mjs:60-77` trzyma węzeł do `animationend`,
  jeśli `data-[state=closed]:animate-out` daje realną animację). Poprawność akcji nieodwracalnej
  wisi więc na klasie CSS, o której plan nie mówi — a jednocześnie każe nadpisać `className`
  na `AlertDialogContent`.
- **Poprawka A ⭐ Zalecana**: Nie owijaj submitu w `AlertDialogAction` — w `AlertDialogFooter`
  zostaje `<AlertDialogCancel>Cancel</AlertDialogCancel>`, a potwierdzenie to
  `<form method="post" action="…"><Button type="submit">Delete team</Button></form>`; okno zamyka
  nawigacja po 302, nie handler Radiksa.
  - Siła: Usuwa klasę problemu zamiast łatać objaw — nie ma wyścigu między unmountem a activation behavior.
  - Kompromis: Rezygnacja z gotowego stylu `AlertDialogAction`; wariant przycisku trzeba podać samemu.
  - Pewność: WYSOKA — kod obu pakietów sprawdzony w `node_modules`; ścieżka `Close → onOpenChange(false)` jest bezwarunkowa.
  - Martwy punkt: Nie sprawdzono, czy `AlertDialogFooter` bez `AlertDialogAction` nie psuje `initialFocus` Radiksa.
- **Poprawka B**: Zostaw `AlertDialogAction asChild`, ale nazwij w planie zależność od klas animacji wyjścia.
  - Siła: Zero zmian w kształcie z planu; stockowy shadcn działa dziś.
  - Kompromis: Poprawność zależy od pliku generowanego przez CLI, który repo i tak musi ręcznie poprawiać.
  - Pewność: ŚREDNIA — działa w dzisiejszej konfiguracji, ale nie z konstrukcji.
  - Martwy punkt: `prefers-reduced-motion` i przyszłe wersje `tw-animate-css` niezbadane.
- **Decyzja**: NAPRAWIONE — Poprawka A (submit poza `AlertDialogAction`; kryterium 3.8 rozszerzone o grep)

### F2 — Odmowa odsyła na ekran, który komunikatu nie pokaże

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: §Pożądany stan końcowy, §Czego NIE robimy, Faza 2 (gałęzie 2, 3, 5)
- **Szczegóły**: Plan twierdzi dwukrotnie, że odmowa „wpada w istniejący `<ServerError>`", i tym
  uzasadnia brak slotu błędu na liście. Kod tego nie potwierdza: `src/pages/teams/[id].astro:78-81`
  liczy `notFound = !teamFailed && team === null`, a szablon (`:82`) renderuje wtedy **`null`** —
  całą stronę. `<ServerError message={error} />` (`:113`) żyje wyłącznie w gałęzi
  `composition !== null && pool !== null` (`:102`). Skutek: gałąź 3 (`deleteTeam` → `null`: cudze id,
  nieznane id, nie-UUID) i gałąź 2 (`createClient` → `null`) kończą się **pustą stroną 404**; komunikat
  widzi wyłącznie gałąź 5 (`throw` na własnym, istniejącym wierszu). Nie jest to dziura bezpieczeństwa
  (dla US-04 brak komunikatu jest wręcz lepszy), ale kryterium ręczne 2.12 sprawdza tylko cel 302,
  więc rozjazd między obietnicą a ekranem przejdzie przez obie bramki weryfikacji niezauważony.
- **Poprawka A ⭐ Zalecana**: Skoryguj plan, nie kod — w §Pożądany stan końcowy i §Czego NIE robimy
  zapisz wprost, że komunikat widzi wyłącznie gałąź `throw`, a `null` i brak klienta kończą się gołym
  404 (to samo, co dziś daje GET na cudze id); dopisz to do kryterium ręcznego 2.12.
  - Siła: Zero nowej powierzchni; zgodne z rozstrzygnięciem „404 vs redirect należy do S-07".
  - Kompromis: Gracz, któremu usunięcie odmówiono, widzi pustą stronę bez wyjaśnienia — realnie
    nieosiągalne z interfejsu, bo przycisk stoi tylko przy własnym wierszu.
  - Pewność: WYSOKA — gałęzie odczytane z `[id].astro:56-82`.
  - Martwy punkt: Brak znaczących.
- **Poprawka B**: Odmowę odsyłaj na `/teams?error=…` i dołóż slot błędu na liście.
  - Siła: Komunikat zawsze widoczny; jeden ekran obsługuje oba wyniki usuwania.
  - Kompromis: Wprost łamie granicę zakresu z §Czego NIE robimy i rozszerza Fazę 3 o drugi baner.
  - Pewność: ŚREDNIA — technicznie proste, ale cofa świadomą decyzję zakresową.
  - Martwy punkt: Nie sprawdzono, czy `ServerError` renderuje się poprawnie w układzie listy.
- **Decyzja**: NAPRAWIONE — Poprawka A (skorygowana proza §Pożądany stan końcowy i §Czego NIE robimy; kryterium 2.12 nazywa puste 404)

### F3 — Nowe asercje `truncate`/`anon` trafią w `revoke` i we własne komentarze

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1, pkt 3 (asercja c) + kryterium automatyczne 1.9
- **Szczegóły**: `allMigrationsWithoutComments()` (`teams-policy-sql.test.ts:44-49`) strzyże wyłącznie
  komentarze — `revoke` zostaje. W korpusie są `revoke update, delete, truncate on public.teams from
  authenticated;` (schema:46) i `revoke all on public.teams from anon;` (schema:44). Asercja napisana
  naiwnie idzie na czerwono natychmiast, na własnej migracji zabezpieczającej. Istniejący wzorzec
  (`:73`, `grantsUpdateOnWholeTable`) kotwiczy się na `grant\s` właśnie dlatego; plan tego wymogu nie
  przenosi. Ta sama pułapka jest w kryterium 1.9: `grep` biegnie po surowych plikach, a plan każe
  nowej migracji opisać w komentarzu, że `truncate` zostaje cofnięty.
- **Poprawka**: W pkt 3 dopisz, że obie nowe asercje muszą być zakotwiczone na `grant\s` (wzorzec
  `grantsUpdateOnWholeTable:73`), bo po zdjęciu komentarzy w korpusie zostają zdania `revoke …
  truncate on public.teams` i `revoke all on public.teams from anon`. W nagłówku migracji nie używaj
  dosłownego ciągu „truncate on public.teams to".
- **Decyzja**: NAPRAWIONE — asercje i kryterium 1.9 zakotwiczone na `grant`; zakaz dosłownego `grant … truncate` w komentarzu migracji

### F4 — `variant="destructive"` na ręcznie stylowanym ciemnym ekranie

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Faza 3, pkt 2 (trigger `DeleteTeamDialog`)
- **Szczegóły**: Plan rozpoznaje ten problem dla treści okna (`AlertDialogContent` dostaje nadpisujący
  `className`, „bo prymityw shadcn wchodzi z jasnymi tokenami `bg-background`") i pomija go dla
  triggera. `src/components/ui/button.tsx:11-22` ma `destructive` na tokenie `bg-destructive`, podczas
  gdy `/teams/[id]` jest w całości ręcznym „cosmic" (`bg-cosmic`, `border-white/10`, `bg-white/5`).
  Repo ma na to własny wariant `cosmic`.
- **Poprawka**: Nazwij wygląd triggera w Umowie — `variant="destructive"` z nadpisującym `className`
  w stylu `MemberPickerDialog.tsx:33` albo czerwony odpowiednik wariantu `cosmic`.
- **Decyzja**: NAPRAWIONE — trigger dostaje nadpisujący `className` (wzorzec `MemberPickerDialog.tsx:33`)

### F5 — Kryterium 2.7 (dokładnie 3×) koliduje z wymogiem docstringu

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 — kryterium automatyczne 2.7 (Progress 2.7)
- **Szczegóły**: Ta sama Umowa każe `grep -c 'DELETE_FAILED_MESSAGE'` = 3 i jednocześnie każe
  docstringowi wyjaśnić, „dlaczego `null` i `throw` mają wspólny komunikat". Naturalne zdanie nazywa
  stałą po imieniu i podnosi licznik do 4. Wzorzec `SAVE_FAILED_MESSAGE` w `[id].ts:25-31` wychodzi
  na 3 tylko dlatego, że jego komentarz stałej nie powtarza.
- **Poprawka**: Zmień 2.7 na `grep -c 'reject(DELETE_FAILED_MESSAGE)'` = 2 — mierzy dokładnie tę
  własność, o którą chodzi, i nie karze dokumentacji.
- **Decyzja**: NAPRAWIONE — kryterium 2.7 mierzy `reject(DELETE_FAILED_MESSAGE)` = 2
