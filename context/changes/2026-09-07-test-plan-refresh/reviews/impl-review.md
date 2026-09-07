<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Refresh test-plan.md — reguła czystości w runtime i odpowiedź na izolację bez Postgresa

- **Plan**: context/changes/2026-09-07-test-plan-refresh/plan.md
- **Zakres**: Fazy 1–4 z 4 (pełny plan; Progress 45/45)
- **Data**: 2026-09-07
- **Werdykt**: WYMAGA UWAGI → po sortowaniu: ZAAKCEPTOWANO (F1, F2, F4 naprawione; F3, F5 świadomie pominięte)
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 3 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

## Zakres wykryty z gita

Baza `17d7aa3` → `ad529b5`. Pięć commitów (d3f70c2, acf2a3e, f83fed7, 114a196, ad529b5),
trzy pliki — wszystkie w planie, zero plików spoza planu, zero elementów planu bez pokrycia:

| Plik | W planie | W dyffie | Werdykt |
|---|---|---|---|
| `context/foundation/test-plan.md` | tak | tak, 12 hunków | MATCH |
| `context/changes/2026-09-07-test-plan-refresh/plan.md` | tak (Progress) | tak | MATCH |
| `context/changes/2026-09-07-test-plan-refresh/change.md` | tak (Faza 4 pkt 2) | tak | DRIFT — świadomy, patrz F4 |

Bariery „Czego NIE robimy" — wszystkie utrzymane: §1 bit-w-bit (26 linii), §7 bit-w-bit
(22 linie), sześć ryzyk w tej samej kolejności z tymi samymi ocenami, cytaty hot-spotów
nietknięte, placeholdery §6.2 i §6.4–§6.6 nietknięte, `context/archive/` bez zmian,
zero zmian w `vitest.config.ts`, `ci.yml` i kodzie testowym, brak siódmego ryzyka.

## Ustalenia

### F1 — Cztery wiersze Progress odhaczone `[x]` mimo czerwonej komendy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-07-test-plan-refresh/plan.md` — Progress 1.4, 2.6, 3.6, 4.8
- **Szczegóły**: `npx prettier --check context/foundation/test-plan.md` zwraca exit 1 — dziś
  i tak samo na `17d7aa3`. Cztery wiersze niosą `[x]` z notą „N/A". `lessons.md`
  §„Kryteria grepowe kotwicz na składni, nie na słowach" mówi wprost: `[x]` nie znaczy
  „intencja spełniona", tylko „komenda zielona"; gdy komenda jest wadliwa, poprawia się
  **komendę w planie**, nie odhacza z adnotacją. Sama decyzja o adaptacji jest merytorycznie
  słuszna i została podjęta przez użytkownika (`--write` przeformatowałby cały plik
  i złamał 4.5/4.6) — defekt jest w księgowaniu, nie w decyzji.
- **Poprawka**: Przepisać treść tych czterech wierszy na kryterium, które faktycznie zostało
  uruchomione i jest zielone: „dyff wobec bazy po znormalizowaniu prettierem obu stron
  ogranicza się do zamierzonych komórek" — zamiast `[x]` przy komendzie, która pada.
- **Decyzja**: FIXED — cztery wiersze Progress przepisane na kryterium dyffu; nota o podmianie dopisana pod konwencją `## Progress`

### F2 — `ci.yml:21` to jedyna kotwica plik:linia w całym przewodniku

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `context/foundation/test-plan.md:68` (§2 *Response* #2, „Likely cheapest layer")
- **Szczegóły**: Sonda nad §2–§8 zwraca dokładnie jedno dopasowanie do wzorca `plik:linia`
  w całym dokumencie — właśnie to. §1 zasada #3 i akapit wstępny §2 zakazują kotwic
  w §2; kontrakt planu jednak literalnie przepisał `ci.yml:21`. Numer linii dryfuje przy
  pierwszej edycji `ci.yml` (dziś `- run: npm test` faktycznie stoi w linii 21 — zweryfikowane).
  Zgłoszone użytkownikowi w trakcie Fazy 2 i przyjęte świadomie; odnotowane, żeby decyzja
  była widoczna w rejestrze, a nie tylko w rozmowie.
- **Poprawka**: Zamienić `ci.yml:21` na `.github/workflows/ci.yml` — fakt („gołe `npm test`,
  bez `services:`, bez `env:`, bez Dockera") zostaje, kotwica przestaje gnić.
- **Decyzja**: FIXED — `ci.yml:21` → `.github/workflows/ci.yml`; przewodnik nie ma już ani jednej kotwicy plik:linia

### F3 — §6.1 „test jednostkowy czystego modułu" niesie receptę na moduł nieczysty

- **Ważność**: 📋 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura (dokumentu)
- **Lokalizacja**: `context/foundation/test-plan.md:153-157`
- **Szczegóły**: Podsekcja nazywa się „Dodanie testu jednostkowego **czystego** modułu",
  a punkt *Czystość* opisuje teraz, co zrobić, gdy moduł pod testem **sięga po
  `@/lib/supabase`** — czyli przypadek należący do §6.2/§6.3, które są jeszcze
  placeholderami. To nie jest dryf wobec planu: kontrakt Fazy 3 pkt 4 wprost tego wymagał,
  bo trzeba było czymś zastąpić szkodliwe „wydziel czysty rdzeń". Koszt jest jednak realny —
  czytelnik §6.1 może wziąć `vi.mock` za receptę na test jednostkowy.
- **Poprawka**: Odłożyć do Fazy 2 wdrożenia: gdy wypełni §6.2/§6.3, przenieść tam człon
  o `vi.mock`, zostawiając w §6.1 samo odesłanie do kryterium runtime z §4. Do tego czasu
  bez zmian — dziś alternatywą byłby powrót do obalonej rady.
- **Decyzja**: SKIPPED — odłożone do Fazy 2 wdrożenia, która wypełni §6.2/§6.3; dziś alternatywą byłby powrót do obalonej rady

### F4 — Kryteria 4.5/4.6 kotwiczą bazę na `HEAD`, który przesuwa się między fazami

- **Ważność**: 📋 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/2026-09-07-test-plan-refresh/plan.md` — Faza 4, kryteria automatyczne
- **Szczegóły**: Kryterium zapisane jako `git show HEAD:context/foundation/test-plan.md`.
  W chwili Fazy 4 `HEAD` to `f83fed7` — commit Fazy 3, a nie stan sprzed refreshu. Gdyby
  któraś z faz 1–3 dotknęła §1 albo §7, kryterium kotwiczone na `HEAD` **by tego nie
  wykryło**. Zweryfikowane obiema bazami (`17d7aa3` i `f83fed7`) — obie dają dyff pusty,
  więc kryterium nie zawiodło; zawiódłby dopiero inny przebieg. To piąte wystąpienie klasy
  „strażnik nie wiąże" z `lessons.md`, tym razem ruchomą częścią jest linia bazowa.
- **Poprawka**: W przyszłych planach kotwiczyć porównanie bazowe na jawnym SHA sprzed
  pierwszego commita zmiany, nigdy na `HEAD`. Kandydat na wpis w `lessons.md`.
- **Decyzja**: FIXED + ACCEPTED-AS-RULE: sekcja „Linię bazową strażnika kotwicz na jawnym SHA, nie na HEAD” w `lessons.md`; kryteria 4.5/4.6 przepisane na `git show 17d7aa3:`

### F5 — §8 dostał zdanie ponad kontrakt

- **Ważność**: 📋 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: `context/foundation/test-plan.md:214`
- **Szczegóły**: Kontrakt Fazy 4: „§8 dostaje **jedną** linię nazywającą ostatni refresh:
  datę, wyzwalacz i dotknięte sekcje". Wpis niesie dodatkowo zdanie „Wpis jest jednorazowy —
  kolejny refresh nadpisuje tę linię, nie dopisuje kolejnej." Kontrakt mówił to **do
  implementującego**, nie do dokumentu.
- **Poprawka**: Zostawić — zdanie chroni ledger przed zamianą w changelog przy kolejnym
  refreshu, czyli robi w dokumencie dokładnie to, co kontrakt chciał osiągnąć. Usunięcie
  to jedna edycja, jeśli wolisz literę kontraktu.
- **Decyzja**: SKIPPED — zdanie zostaje; robi w dokumencie to, co kontrakt chciał osiągnąć

## Kryteria sukcesu — przebieg dosłowny

Wszystkie 25 kryteriów automatycznych uruchomione ponownie. 20 zielonych. Pięć nie
przechodzi w literze, wszystkie pięć z jawnej decyzji użytkownika podjętej w trakcie:

| Kryterium | Stan | Powód |
|---|---|---|
| 1.4, 2.6, 3.6, 4.8 | czerwone | `prettier --check` pada też na `17d7aa3`; `--write` złamałby 4.5/4.6 — patrz F1 |
| 4.7 | czerwone | `change.md` ma `implemented`, nie `planned` — cykl życia `/10x-implement` zastępuje kryterium etapu planowania |

Elementy ręczne 1.6–1.8, 2.7–2.11, 3.7–3.11, 4.10–4.13 — wszystkie `[x]`, wszystkie
z widocznym pokryciem w dyffie (żadnego „podpisania na ślepo").
