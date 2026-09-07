<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Wspólny nagłówek z użytkownikiem i menu nawigacyjnym na każdej stronie

- **Plan**: `context/changes/2026-09-06-app-shell-header-nav/plan.md`
- **Zakres**: Fazy 1-3 z 3 (pełny przegląd planu)
- **Data**: 2026-09-07
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Kryteria sukcesu | WARNING |

Kod wdrożony jest zgodny z planem co do intencji we wszystkich dziesięciu pozycjach umowy — nie
znaleziono żadnego DRIFT, MISSING ani EXTRA o charakterze funkcjonalnym. Wszystkie trzy ostrzeżenia
dotyczą **umowy weryfikacyjnej**, nie wdrożonego kodu: strażniki automatyczne przechodzą dosłownie,
ale kilka z nich nie wiąże tego, co miało wiązać.

Zweryfikowane lokalnie: `npm test` 169/169 zielone (15 plików), `npm run lint` 0 błędów i 1 warning
(`astro/prefer-class-list-directive` w `AppHeader.astro:49` — nazwany w planie jako świadomy
kompromis), `npm run build` przechodzi, bramka wymagania wstępnego 1.1 zielona. Wszystkie 12
strażników grepowych planu przechodzi dosłownie. `Layout.astro`, `src/pages/auth/`, `middleware.ts`,
`src/pages/api/`, `supabase/`, `src/lib/team-repo.ts` i `src/lib/routes.ts` — nietknięte, zgodnie
z sekcją „Czego NIE robimy".

Niezmiennik izolacji S-07 zachowany: obie trasy dynamiczne renderują `<TeamNotFound />` bez propsów,
a powłoka nie wnosi różnicy między „cudze id" a „nieistniejące id" — `AppHeader` zależy wyłącznie od
`Astro.locals.user` i `Astro.url.pathname`, identycznych dla tego samego URL niezależnie od
właściciela wiersza. `TeamNotFound.astro` ma teraz zero znaczników `<a>`, więc nie ma nawet różnicy
w liczbie linków. `Astro.response.status = 404` zostało na stronach wywołujących.

## Ustalenia

### F1 — Strażniki tras (2.6, 3.1) były zielone, zanim faza się zaczęła

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-06-app-shell-header-nav/plan.md:316,425`
- **Szczegóły**: Kryteria 2.6 (`! grep -nE 'href="/(dashboard|teams)"' src/components/team/TeamNotFound.astro`)
  i 3.1 (`! grep -rnE 'href="/(dashboard|teams)"' src/`) miały potwierdzić wycięcie linków powrotnych.
  `git grep -nE 'href="/(dashboard|teams)"' b5c64fa^ -- src/` nie zwraca **nic**: wymaganie wstępne
  `2026-09-06-teams-list-as-home` przepisało już te linki na `href="/"`. Oba strażniki były więc
  zielone przed pierwszym commitem tej zmiany i pozostałyby zielone, gdyby faza 3 nie zrobiła nic.
  Realna praca — wycięcie siedmiu linków `href="/"` i `href="/teams/new"` z `TeamNotFound.astro`,
  `new.astro`, `[id].astro` i `embark.astro` — nie ma **żadnego** pokrycia automatycznego; pilnuje
  jej wyłącznie ręczne 3.11. Sonda: ponowne wklejenie karty z linkiem „← Your teams" przechodzi
  wszystkie 12 strażników na zielono. Praca została wykonana poprawnie (potwierdzone: w stronach
  powłoki został dokładnie jeden `<a>` — `View this team` w `embark.astro:79`), ale nie dzięki
  strażnikowi.
- **Poprawka A ⭐ Zalecane**: Zapisać jako powtarzającą się regułę (`/10x-lesson`): strażnik, który
  jest zielony na commicie bazowym, nie wiąże niczego — przed odhaczeniem trzeba potwierdzić, że
  czerwieni się **przed** zmianą.
  - Siła: To trzecia z rzędu zmiana, w której strażnik grepowy nie wiąże tego, co miał; dwie
    istniejące lekcje w `lessons.md` pokrywają kotwiczenie i warianty zapisu, ale **żadna** nie
    pokrywa braku czerwonej linii bazowej. Reguła działa na wszystkie przyszłe plany, a nie na
    jeden zamknięty.
  - Kompromis: Ta konkretna zmiana zostaje bez strażnika; regresja linku powrotnego przejdzie na
    zielono także jutro.
  - Pewność: WYSOKA — brak trafień na `b5c64fa^` sprawdzony bezpośrednio przez `git grep`.
  - Martwy punkt: Nie sprawdzono, ile wcześniejszych planów w `context/archive/` ma tę samą wadę.
- **Poprawka B**: Dopisać do planu strażnika na etykiety, których zmiana faktycznie broni, i uruchomić
  go teraz: `! grep -rnE '>\s*(←\s*)?(Your teams|Back to your teams|Assemble another team|Back to dashboard)' src/pages src/components/team`
  - Siła: Domyka lukę w tej zmianie natychmiast i zostaje w repo jako bariera przy następnej edycji
    tych czterech plików.
  - Kompromis: Strażnik kotwiczy się na tekście widocznym dla użytkownika, więc zmiana copy go
    czerwieni fałszywie; dopisywanie kryterium do planu, który jest już zamknięty i odhaczony 37/37,
    zaciera granicę „plan jest umową sprzed implementacji".
  - Pewność: ŚREDNIA — wzorzec przesondowany na etykietach usuniętych w tej zmianie, ale nie na
    przyszłych.
  - Martwy punkt: Nie zweryfikowano, czy etykiety nie występują w `src/components/**/*.tsx`.
- **Decyzja**: ACCEPTED-AS-RULE: „Strażnik, który jest zielony na commicie bazowym, nie wiąże
  niczego" (`context/foundation/lessons.md`). Poprawka B świadomie **nie** zastosowana —
  ustalenie zostaje nienaprawione w tej zmianie, reguła zapisana do przyszłej pracy.

### F2 — Nic nie wiąże obecności `<AppHeader />` w powłoce

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `src/layouts/AppLayout.astro:30`
- **Szczegóły**: Cała zmiana opiera się na zdaniu „wybór layoutu jest jedynym przełącznikiem
  obecności nagłówka" (`AppLayout.astro:11-14`). Usunięcie samej linii `<AppHeader />` zostawia
  **wszystkie 12 strażników i 169 testów zielone**, a jednocześnie kasuje jedyne wyjście z każdego
  z pięciu ekranów — bo faza 3 wycięła wszystkie linki powrotne, a `TeamNotFound.astro` nie ma już
  ani jednego `<a>`. To dokładnie ta klasa awarii cichej, przed którą ostrzega
  `lessons.md` → „Wyspa bez `client:*` i flaga trybu odczytu to jedna zmiana, nie dwie". Pokrycie
  jest wyłącznie ręczne (Progress 2.11, 2.13, 3.9).
- **Poprawka**: Dodać strażnika pozytywnego do kryteriów fazy 2: `grep -n '<AppHeader' src/layouts/AppLayout.astro`.
- **Decyzja**: FIXED — strażnik `grep -n '<AppHeader' src/layouts/AppLayout.astro` dopisany do
  kryteriów automatycznych Fazy 2 (`plan.md`) plus krok Progress 2.17. Uruchomiony: zielony na
  HEAD (`AppLayout.astro:30`), czerwony na commicie bazowym `b5c64fa^` (pliku tam nie ma) —
  próba linii bazowej wg lekcji z F1 przeszła, więc strażnik faktycznie wiąże.

### F3 — Pięć strażników pilnuje jednego zapisu, nie operacji

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-06-app-shell-header-nav/plan.md:178,179,311,320,432`
- **Szczegóły**: Sondy na kopiach plików poza repozytorium pokazują, że pięć strażników przepuszcza
  legalne warianty zapisu tej samej operacji:
  - `plan.md:311` (`href="` w `AppHeader`) — łapie `href="/teams/new"`, przepuszcza `href={"/teams/new"}`,
    `href='/teams/new'`, `` href={`/teams/new`} ``. Plan deklaruje sondę, ale przesondował wyłącznie
    wariant, który strażnik łapie.
  - `plan.md:432` (`^return `) — kotwica na kolumnie 0 przepuszcza `  return Astro.redirect("/")`
    i `if (notFound) { return new Response(...) }`, czyli **najbardziej prawdopodobny** zapis
    wczesnego wyjścia; oba wywracają `npm run lint` dokładnie tak, jak opisuje lekcja S-03.
  - `plan.md:179` (`"/(dashboard|teams)"` w `nav.ts`) — przepuszcza `'/teams'`, `` `/teams` ``,
    `"/teams/"`. Tę samą dziurę ma asercja `nav.test.ts:102-107`: `not.toBe("/teams")` przepuszcza
    `"/teams/"`, które `normalize()` sprowadza z powrotem do `/teams` — trasy, która po wymaganiu
    wstępnym nie istnieje.
  - `plan.md:178` (importy w `nav.ts`) — przepuszcza `import "astro:env/server"`,
    `export * from "@/lib/supabase"`, `await import("@/lib/supabase")`, import względny.
  - `plan.md:320` (`Astro\.props` w `TeamNotFound`) — przepuszcza `Astro["props"]` i
    `const { props } = Astro`; ten akurat pilnuje niezmiennika izolacji S-07.

  Każdy ma drugą barierę (`npm run lint` albo `npm test`), więc żaden nie przepuściłby realnej
  regresji po cichu — dlatego to ostrzeżenie, nie błąd krytyczny. Istotna jest **powtarzalność**:
  `lessons.md` ma już dwie reguły o tej klasie, obie napisane pod SQL, i obie zostały tu spełnione
  co do litery („kotwicz na składni", „strzyż komentarze"), a mimo to klasa wróciła — tym razem po
  stronie JSX/TS.
- **Poprawka A ⭐ Zalecane**: Rozszerzyć istniejącą lekcję „Strażnik grepowy nad SQL-em ma pokrywać
  legalne warianty zapisu" o warianty cytowania w JSX/TS (`href={"…"}`, `'…'`, backticki), o wcięcie
  przed `return` i o formy importu (`import "…"`, `import(…)`, re-eksport).
  - Siła: Jeden wpis pokrywa wszystkie pięć strażników naraz i przenosi się na każdy przyszły plan;
    poprawianie ich pojedynczo w zamkniętym planie nie chroni następnej zmiany.
  - Kompromis: Nie zmienia niczego w tej zmianie — pięć strażników zostaje słabych tam, gdzie są.
  - Pewność: WYSOKA — każdy wariant przesondowany na kopii poza repozytorium, z potwierdzeniem,
    że wariant rozbrajający przechodzi na zielono.
  - Martwy punkt: Nie sprawdzono, czy inne plany w `context/changes/` używają tych samych wzorców.
- **Poprawka B**: Poprawić pięć wzorców w `plan.md` na miejscu, każdy z osobna.
  - Siła: Strażniki w tym planie zaczynają wiązać operację, a nie zapis.
  - Kompromis: Edycja zamkniętego planu (37/37 odhaczone) po fakcie; nie chroni następnej zmiany,
    a klasa błędu wróci przy kolejnym planie.
  - Pewność: ŚREDNIA — poprawione wzorce trzeba przesondować od nowa, inaczej powtórzy się dokładnie
    ten błąd, który opisują.
  - Martwy punkt: Nie oszacowano, czy poprawione wzorce nie czerwienią się fałszywie na obecnym drzewie.
- **Decyzja**: ACCEPTED-AS-RULE: „Strażnik grepowy nad JSX/TS — wariantów cytowania jest cztery,
  a `return` bywa wcięty" (`context/foundation/lessons.md`, dopisana jako rozwinięcie lekcji
  o SQL-u, zgodnie z precedensem rejestru „tylko do dodawania"). Poprawka B świadomie **nie**
  zastosowana — pięć wzorców zostaje jak jest, domyka je druga bariera (`npm run lint` /
  `npm test`), a reguła chroni przyszłe plany.

### F4 — Progress przypisuje kroki 2.1-2.2 do niewłaściwego commitu

- **Ważność**: 📋 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-06-app-shell-header-nav/plan.md:540-541`
- **Szczegóły**: Faza 2 wylądowała w dwóch commitach. `ed11612` ma komunikat opisujący cztery
  zmiany (`AppHeader`, `AppLayout`, `TeamNotFound`, kasacja `Topbar`), ale jego diff zawiera
  **wyłącznie** kasację `Topbar.astro` (1 plik, 40 usunięć); pozostałe trzy pliki przyszły dopiero
  w `f6f5266`. Progress podpisuje wszystkie kroki 2.1-2.16 hashem `f6f5266`, więc kroki 2.1
  („`Topbar.astro` nie istnieje") i 2.2 wskazują commit, który tej kasacji nie zawiera. Bez skutków
  funkcjonalnych — czysta traceability.
- **Poprawka**: Zmienić hash przy 2.1 i 2.2 na `ed11612`, albo dopisać oba hashe, żeby ślad
  prowadził do commitu, który faktycznie wykonał krok.
- **Decyzja**: FIXED — kroki Progress 2.1 i 2.2 przepisane z `f6f5266` na `ed11612`
  (`plan.md:543-544`). Potwierdzone: `git show --stat ed11612` to dokładnie
  `src/components/Topbar.astro | 40 ----`, jeden plik, same usunięcia.
