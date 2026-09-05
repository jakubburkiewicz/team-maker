<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Kompletowanie składu drużyny z okna wyboru członka (S-01)

- **Plan**: context/changes/team-roster-composition/plan.md
- **Zakres**: Fazy 1–3 z 3 (pełny przegląd planu; diff `f4edacf..HEAD`, commity 75f6156, 80f60cd, fafdd83, 98216b8)
- **Data**: 2026-09-05
- **Werdykt**: ZAAKCEPTOWANO
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 4 obserwacje

## Werdykty

| Wymiar                  | Werdykt                  |
| ----------------------- | ------------------------ |
| Zgodność z planem       | WARNING (1 ustalenie)    |
| Dyscyplina zakresu      | WARNING (1 ustalenie)    |
| Bezpieczeństwo i jakość | PASS                     |
| Architektura            | PASS                     |
| Spójność wzorców        | PASS (3 obserwacje)      |
| Kryteria sukcesu        | PASS                     |

## Weryfikacja kryteriów sukcesu

Automatyczne (uruchomione w tym przeglądzie, Node 22.14.0 z `.nvmrc`):

| Kryterium                                                    | Wynik                                 |
| ------------------------------------------------------------ | ------------------------------------- |
| `npx astro sync && npm run lint`                             | PASS (exit 0, tylko ostrzeżenia parsera o `projectService`) |
| `npm test`                                                   | PASS (6 plików, 51 testów, 13 w `roster.test.ts`) |
| `npm run build`                                              | PASS (Complete!, brak błędów)         |
| `grep -rE "from ['\"](astro:\|@/lib/supabase)" src/lib/domain/` | pusto                              |
| `grep -rl "lib/supabase" --include='*.test.ts' src`          | pusto                                 |
| `@radix-ui/react-dialog` w `dependencies`                    | PASS (`^1.1.23`)                      |

Ręczne: wszystkie 10 pozycji (1.5, 2.4–2.6, 3.5–3.11) oznaczone `[x]` z SHA. Kontrola mutacyjna 1.5 **powtórzona w przeglądzie**: `MAX_TEAM_SIZE = 7` wywala 5 z 13 testów `roster.test.ts` (w tym „siódmy członek odrzucony"), drzewo przywrócone. Pozycje 2.4–2.6 i 3.5–3.11 mają pokrycie w kodzie (ochrona trasy `middleware.ts:4`, `try/catch` w `new.astro:17-23`, brak „Recruit" przy 6/6 z konstrukcji `TeamComposer.tsx:44-47`) — brak sygnałów „podpisywania na ślepo".

## Ustalenia

### F1 — Nieplanowana zmiana `astro.config.mjs` udokumentowana tylko w commicie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: astro.config.mjs:15-22
- **Szczegóły**: Plan nie przewidywał dotykania konfiguracji („Jedyna zmiana zależności: `@radix-ui/react-dialog`"). Dodano `vite.ssr.optimizeDeps.include: ["astro/env/runtime"]` z komentarzem. Zmiana jest **dev-only** (`optimizeDeps` nie wpływa na `astro build` ani na bundle Workers — build przeszedł), celuje w publiczny subpath export `astro@6.3.1` i naprawia realny błąd „Invalid hook call" (dwie kopie Reacta po reoptymalizacji `deps_ssr` na zimnym cache), który blokował ręczną weryfikację 3.5–3.11. Odstępstwo zadeklarowane wyłącznie w wiadomości commita `fafdd83`. Dotyczy każdej przyszłej wyspy React za `astro:env`, nie tylko S-01 — po archiwizacji wiedza zniknie z `context/`.
- **Poprawka**: Dopisać do `plan.md` (np. sekcja „Odstępstwa od planu" pod „Uwagi dotyczące migracji") jedno zdanie: co dodano, że to dev-only i dlaczego; kod zostawić.
- **Decyzja**: FIXED — sekcja „Odstępstwa od planu" dopisana do plan.md

### F2 — `dialog.tsx` edytowany ręcznie, bo plan był sprzeczny z shadcn CLI 4.x

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/components/ui/dialog.tsx:2,6
- **Szczegóły**: Plan (Faza 3 §1): „Nie edytować wygenerowanego pliku poza tym, co wymusi `npm run lint:fix`" — a jednocześnie kryterium 3.4 wymaga `@radix-ui/react-dialog` w `dependencies`. shadcn CLI 4.x generuje dziś `import { Dialog as DialogPrimitive } from "radix-ui"` (pakiet parasolowy) oraz `import { cn } from "cn"`. Implementacja ręcznie zamieniła oba importy na `@radix-ui/react-dialog` i `@/lib/utils` (zadeklarowane w commicie `fafdd83`). Ciała wszystkich 10 komponentów są identyczne z rejestrem `new-york-v4`; `global.css`, `components.json` nietknięte; `package-lock.json` bez śladów `radix-ui`/`cn`. Odchylenie jest kosmetyczne, ale **powtórzy się** przy S-06 (`npx shadcn add alert-dialog`) i każdym kolejnym prymitywie — bez decyzji z góry każdy `shadcn add` będzie wymagał ręcznej korekty importów.
- **Poprawka A ⭐ Zalecane**: Zostawić kod; zapisać regułę projektu: „po `npx shadcn add <x>` zamień `radix-ui` → `@radix-ui/react-<x>` (dodaj do deps) i `cn` → `@/lib/utils`; sprawdź `git diff` na `components.json`/`global.css`".
  - Siła: Spójne z istniejącym `button.tsx` (`@radix-ui/react-slot`) i z kryterium 3.4; zero zmian w kodzie; reguła jest krótka i deterministyczna.
  - Kompromis: Każdy nowy prymityw to ręczna korekta dwóch linii, którą trzeba pamiętać.
  - Pewność: WYSOKA — dokładnie tak zrobiono w tej zmianie i lint/build przeszły.
  - Martwy punkt: Nie sprawdzono, czy `components.json` da się skonfigurować tak, by CLI 4.x samo generowało importy per-pakiet (jeśli tak, reguła stanie się zbędna).
- **Poprawka B**: Przejść na pakiet parasolowy `radix-ui`: `npm i radix-ui`, usunąć `@radix-ui/react-dialog` i `@radix-ui/react-slot`, przepisać importy w `dialog.tsx` i `button.tsx` na `from "radix-ui"`.
  - Siła: Przyszłe `shadcn add` wchodzą bez edycji; jedna zależność zamiast N.
  - Kompromis: Dotyka istniejącego `button.tsx` (poza zakresem S-01), zmienia `package.json` wbrew kryterium 3.4 planu, większy bundle do tree-shakingu przez Vite (parasol re-eksportuje wszystkie prymitywy).
  - Pewność: ŚREDNIA — nie zweryfikowano tree-shakingu `radix-ui` w buildzie Cloudflare ani wpływu na `cn` (ten import CLI i tak generuje błędnie).
  - Martwy punkt: Rozmiar bundle'a klienta po zmianie; zachowanie `@radix-ui/react-slot` przez `radix-ui`.
- **Decyzja**: ACCEPTED-AS-RULE: Po `npx shadcn add` popraw importy na pakiety per-prymityw (Poprawka A; kod bez zmian, wpis w `context/foundation/lessons.md`)

### F3 — Testy składu używają produkcyjnej puli i literału `"vesper"`

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/lib/domain/roster.test.ts:33,56,58
- **Szczegóły**: Plan wprost wskazał `CHARACTER_POOL` jako pulę testową, więc użycie produkcyjnej stałej jest zgodne z planem. Ale sąsiedni `evaluate-team.test.ts` pracuje na `TEST_POOL` z `test-fixtures.ts`, a `roster.test.ts` w trzech miejscach wpisuje na sztywno id `"vesper"`, mimo że ma już `POOL_IDS` (l. 13). Zmiana nazwy/reseed puli w przyszłej migracji złamie testy modułu, którego przedmiot się nie zmienił.
- **Poprawka**: Zamienić `"vesper"` na `POOL_IDS[0]` w trzech miejscach (test dalej korzysta z `CHARACTER_POOL`, jak chciał plan).
- **Decyzja**: FIXED — cztery wystąpienia → `POOL_IDS[0]` (l. 33, 35, 56, 58); `removeMember([], "vesper")` na l. 103 zostawione celowo (dowolny nieobecny id). 13/13 testów, eslint czysty.

### F4 — Sześć przycisków „Remove" z identyczną nazwą dostępną

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/team/RosterSlot.tsx:33-42
- **Szczegóły**: Czytnik ekranu nie odróżni, którego członka dotyczy „Remove". PRD wyłącza WCAG-AA z zakresu (Non-Goals), a `MemberPickerDialog` już dba o `aria-pressed` i `DialogTitle`/`DialogDescription`, więc to jedyne miejsce bez etykiety.
- **Poprawka**: `aria-label={\`Remove ${member.name}\`}` na przycisku.
- **Decyzja**: FIXED — `aria-label` dodany (`RosterSlot.tsx:35`), eslint czysty.

### F5 — Punkty kontrolne dla S-03/S-04 (nieosiągalne dziś)

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Architektura
- **Lokalizacja**: src/components/team/TeamComposer.tsx:44-47; src/middleware.ts:4,18
- **Szczegóły**: (a) Slot z `characterId` spoza `pool` jest cicho mapowany na `null` i renderuje się jako „Recruit", choć licznik go liczy — dziś nieosiągalne (`addMember` odrzuca `unknown-character`, pula i skład z jednego propsa), ale przy S-04 (skład z bazy + pula z bazy) gałąź stanie się osiągalna. (b) Prefiks `/teams` w `PROTECTED_ROUTES` **nie** obejmuje `/api/teams/*` — S-03 musi dodać trasy API jawnie albo sprawdzać `locals.user` w handlerze. Oba to wzorce pre-existing/z planu, nie błędy tej zmiany.
- **Poprawka**: Nic w S-01; dopisać obie uwagi do bloków S-03 i S-04 w `roadmap.md` (Niewiadome/Ryzyko), żeby plany tych fragmentów je zobaczyły.
- **Decyzja**: FIXED — punkty kontrolne dopisane do „Ryzyko" w blokach S-03 (middleware/`/api/teams/*`) i S-04 (nieznany `characterId`) w `roadmap.md`; kod bez zmian.

### F6 — Ten sam ciąg klas przycisku CTA skopiowany w trzech miejscach

- **Ważność**: 🔍 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/components/team/MemberPickerDialog.tsx:125; src/components/auth/SubmitButton.tsx:18; src/pages/dashboard.astro:19
- **Szczegóły**: Plan świadomie nakazał nadpisywać `Button` klasami „jak `SubmitButton`" (Non-Goal: przebudowa motywu), więc to zgodne z planem. Przy trzech kopiach jeszcze nie wzorzec; S-02 („Wyrusz na zlecenie") doda czwartą.
- **Poprawka**: Nic teraz; przy S-02 dodać wariant `cosmic` do `buttonVariants` w `ui/button.tsx` zamiast kolejnej kopii.
- **Decyzja**: SKIPPED — zgodne z planem; do rozważenia przy S-02, gdy pojawi się czwarta kopia.

## Poza ustaleniami (bez akcji)

- `roster.test.ts:50` sprawdza `toHaveLength(6)` zamiast „ta sama referencja" — plan opisał asercję nieprecyzyjnie: odrzucony `AddMemberResult` nie niesie składu, więc referencji nie ma z czym porównać; `toEqual` na l. 49 pokrywa intencję.
- Dodatkowe testy (pełny skład + nieznana postać, powrót usuniętej postaci, `unknown-character` ↔ `unknown-character`) i drobne EXTRA w `MemberPickerDialog` („Already in team", gałąź pustego wyboru, `aria-pressed`) rozszerzają dowód/UX w kierunku planu.
- `Topbar` jest osadzony tylko w `Welcome.astro`, więc link „New team" nie pojawia się na `/dashboard` — nawigacja działa przez własne linki stron; zgodne z planem.
- Sekcja „Czego NIE robimy" dotrzymana w całości: brak wyboru perków, `evaluateTeam` nie wołane z UI, brak `sessionStorage`/`localStorage`, brak migracji i tras API, brak jsdom/Testing Library, `global.css`/`components.json` nietknięte.
- `roadmap.md` ma S-01 `in-progress`, `change.md` — `implemented`; domknięcie należy do `/10x-archive`.
- Domyślny Node w powłoce to 20.19.0 (`astro sync` odmawia); z `nvm use` (22.14.0 z `.nvmrc`) wszystko przechodzi. Środowisko, nie zmiana.
