# Bariera serwerowa zapisu drużyny — krótki plan

> Pełny plan: `context/changes/2026-09-07-testing-save-barrier/plan.md`
> Badania: `context/changes/2026-09-07-testing-save-barrier/research.md`

## Co i dlaczego

Faza 1 wdrożenia z `context/foundation/test-plan.md` §3, pokrywająca ryzyka #1 i #6. Bariera progu
i limitów **stoi w kodzie** — obie trasy zapisu wołają tę samą bramkę `gateTeamSubmission`, a ona
egzekwuje próg i wszystkie sześć limitów. Nie stoi natomiast **nic, co ten fakt wiąże**: usunięcie
trzech linii `if (!gate.ok)` z trasy zostawia komplet 17 plików testowych na zielono, a produkt
utrwala dowolny skład. Faza dokłada pierwszy automat nad jedyną istniejącą barierą.

## Punkt wyjścia

Reguła ma gęste pokrycie jednostkowe (193 testy, 17 plików), ale **żaden z nich nie importuje
niczego z `src/pages/`**. Cała siedmiokrokowa sekwencja trasy — sesja, klient, `formData()`, pole,
pula, bramka, repo — nie ma ani jednej asercji. Baza nie jest drugą linią obrony: jedyne
ograniczenie na `composition` to `jsonb_typeof = 'array'`, a próg świadomie nie jest powtórzony
w SQL (S-03). Jedyną barierą jest Worker.

## Pożądany stan końcowy

`src/lib/team-save-route.test.ts` wykonuje `POST /api/teams` i `POST /api/teams/[id]` w Node, na
atrapie klienta Supabase, i dowodzi skutkiem, że żądanie łamiące próg albo którykolwiek z pięciu
limitów **nie zostawia zapisu**. `scripts/probe-save-barrier.sh` dowodzi, że ten test czerwieni się
na rozbrojonej barierze. §6.2 książki kucharskiej przestaje brzmieć `TBD` i staje się odpowiedzią
na „jak dodać test toru zapisu w tym projekcie" — z której korzystają Fazy 2–4 wdrożenia.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Wykonanie toru bez łamania czystości testów | `vi.hoisted` + `vi.mock("@/lib/supabase")`, zero zmian w konfiguracji | Kryterium `AGENTS.md` to **runtime**, nie treść importu; mock jest hoistowany, więc `astro:env/server` nigdy się nie ewaluuje | Badania |
| Zakres tras | Oba pisarze składu (`index.ts` + `[id].ts`), bez `delete` | Bramka jest dzielona celowo (S-05), więc rozbrojenie jednej trasy to realny wariant awarii; `delete` nie czyta ciała i należy do Fazy 2 | Plan |
| Kształt atrapy klienta | Nagrywająca dziennik zapisów, **rzucająca** przy nieznanym zapytaniu | Główna asercja „dziennik pusty" jest wprost dowodem Guardraila; rzucanie zamyka klasę „atrapa cicho rozjechała się z bazą", którą §2 test-planu nazywa anty-wzorcem | Plan |
| Kontrola mutacyjna | Skrypt sondy w repo, uruchamiany ręcznie, poza CI | Pięć wpisów `lessons.md` opisuje awarię „komenda założona, nie uruchomiona"; skrypt czyni uruchomienie tańszym niż założenie, bez ruszania `ci.yml` | Plan |
| Kanoniczna mutacja | Zapis przez `createTeam` **przed** odmową, zamrożony w `scripts/probe-save-barrier.patch` | Nie jest przestawieniem linii (`gate.composition` przed bramką nie istnieje), więc treść musi być artefaktem, nie prozą; wariant poprawny typowo, żeby czerwień pochodziła z asercji, nie z typów. **Nieprzesondowany** — sonda badania czerwieniła na usunięciu `if (!gate.ok)`, które zresztą przeszłoby CI (`astro check` nie jest ani krokiem CI, ani skryptem npm) | Plan |
| Zakres pokrycia | Cała siedmiokrokowa sekwencja + kontrakt odmowy | Kosztem fazy jest osprzęt, nie asercje; wiąże też twardą regułę „odmowa to redirect z `?error=`, nie JSON", której dziś nie pilnuje nic | Plan |
| Lokalizacja pliku | `src/lib/`, nie obok trasy | Astro traktuje każdy `.ts` w `src/pages/` jako endpoint — test obok trasy wszedłby do builda produkcyjnego jako `/api/teams/index.test` | Plan |

## Zakres

**W zakresie:** atrapa klienta Supabase, atrapa `APIContext`, fixtura puli z `CHARACTER_POOL`;
próg i sześć limitów × dwie trasy; kontrakt odmowy (302, `?error=`, mapowanie `reason.kind`);
siedem kroków glue; skrypt sondy rozbrajającej; §6.2 książki kucharskiej i stemple §3/§4/§5.

**Poza zakresem:** `vitest.config.ts` i `ci.yml` (sonda dowiodła, że niepotrzebne); jakakolwiek
zmiana w `src/pages/` i `src/lib/` poza nowym plikiem testowym; `POST /api/teams/[id]/delete`;
dwie luki `gateTeamSubmission` (`duplicate-character`, `unknown-perk` — pokrycie warstwy już
testowanej, nie może podszyć się pod dowód bariery); prawdziwy Postgres; kolejność `violations`.

## Architektura / Podejście

```
test → vi.mock("@/lib/supabase") → atrapa createClient
     → await import("@/pages/api/teams/index")
     → POST(atrapa APIContext)
         ├─ getCharacterPool(atrapa) → wiersze z CHARACTER_POOL
         ├─ gateTeamSubmission(raw, pool)   ← punkt, o który chodzi
         └─ createTeam(atrapa) → wpis do dziennika zapisów
                                    ↑ asercja: pusty przy każdej odmowie
```

Osprzęt jest drogi, asercje tanie — stąd kolejność faz. Faza 1 stawia atrapy i **od razu** dowodzi
skryptem sondy, że one wiążą; dopiero na przesondowanym osprzęcie Fazy 2 i 3 dokładają przypadki.
Wyrocznia pochodzi z Guardraili PRD, nigdy ze `scores` (odzwierciedla surowy wybór, także odrzucony).

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Osprzęt i pierwszy przypadek wiążący | Trzy atrapy, asercja „zero zapisów", skrypt sondy | Atrapa przepuszczająca za dużo daje zielony test na rozbrojonej barierze |
| 2. Komplet ryzyk #1 i #6 | Próg + sześć limitów × dwie trasy, kontrakt odmowy | Lustro implementacji — wartość przepisana z kodu zamiast z PRD |
| 3. Glue trasy | Siedem kroków, w tym gałęzie chroniące przed 500 | Przypadki spoza ryzyk #1/#6 rozdymają fazę bez pokrycia ryzyka |
| 4. Książka kucharska i bramki | §6.2, stemple §3/§4/§5, `change.md` | §6.2 opisujące ten test zamiast wzorca — bezużyteczne dla Fazy 2 wdrożenia |

**Wymagania wstępne:** żadnych. Normatywne pytanie o czystość testów rozstrzygnięto w badaniu
i utrwalono w `AGENTS.md`; sonda na prawdziwej konfiguracji repozytorium przeszła przed napisaniem
planu. Baza sondy: `a392c62`.

**Szacowany wysiłek:** ~3–4 sesje w czterech fazach; Faza 1 jest najdroższa (cały osprzęt),
Fazy 2–3 to głównie przypadki po kilka linii.

## Otwarte ryzyka i założenia

- **Atrapa klienta jest ręcznie pisana**, więc może cicho rozjechać się z zachowaniem prawdziwej
  bazy — §2 test-planu wymienia to jako anty-wzorzec przy #1 i #6. Odpowiedź: atrapa **rzuca** przy
  nieznanym zapytaniu, a sonda rozbrajająca jest warunkiem odhaczenia każdej fazy. Ryzyko nie
  znika — zielony test na atrapie nadal nie dowodzi zachowania Postgresa, tylko zachowania Workera.
  To jest granica świadoma: bariera, o którą chodzi, stoi **przed** bazą.
- **Skrypt sondy modyfikuje plik śledzony przez git.** Przerwanie w połowie zostawiłoby rozbrojoną
  trasę w drzewie roboczym; mitygacja to `trap` przed pierwszą modyfikacją i odmowa startu na
  brudnym drzewie, obie sprawdzane ręcznie.
- **Kanoniczna mutacja jest jedna.** Sonda pilnuje jednego wariantu rozbrajającego; inne (np.
  podmiana puli na pustą) nie są pokryte. Rozszerzanie listy mutacji zostaje poza zakresem.

## Kryteria sukcesu (podsumowanie)

- Żądanie ze składem poniżej progu albo łamiącym którykolwiek z sześciu limitów, wysłane z pominięciem
  interfejsu do **którejkolwiek** z dwóch tras zapisu, nie zostawia wiersza i kończy się odmową.
- `scripts/probe-save-barrier.sh` czerwieni na przestawieniu zapisu przed bramkę i przywraca drzewo
  do czystego stanu.
- Ktoś, kto nie brał udziału w tej fazie, dopisuje test toru zapisu wyłącznie na podstawie §6.2.
