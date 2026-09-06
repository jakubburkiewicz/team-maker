# Edycja składu zapisanej drużyny (S-05) — Krótki plan

> Pełny plan: `context/changes/edit-saved-team/plan.md`

## Co i dlaczego

Gracz ma móc otworzyć zapisaną drużynę, wymienić członka albo zmienić jego perki i zapisać zmiany —
pod **tym samym progiem**, który przepuścił pierwszy zapis, i bez tknięcia nazwy-hasha. Domyka **U**
z czterech operacji CRUD (US-02, FR-009, FR-011, FR-018), czyli jeden z czterech warunków
certyfikacji, po które sięga persona główna.

## Punkt wyjścia

S-04 zbudował `/teams/[id]` jako **świadomie martwy podgląd**: `TeamComposer` renderowany serwerowo
w trybie `readOnly`, bez `client:load`, z notą w kodzie „Nota dla S-05: podłączając zapis, trzeba
dopisać `client:load` z powrotem". Równolegle migracja `20260905185700_teams_schema.sql` cofnęła
przywilej `update` i zapisała w komentarzu, że politykę dołoży S-05 własną migracją. Cała bramka
progu (`gateTeamSubmission`) i ochrona przed cichym skasowaniem członka (`resolveSavedTeam`) już
istnieją i nie wymagają zmian.

## Pożądany stan końcowy

`/teams/[id]` jest jednym ekranem obsługującym oglądanie i edycję: wyspa hydratowana, sloty
klikalne, bramka pod wykresem nosi napis „Save changes". Usunięcie członka albo odznaczenie perka,
które cofa którąkolwiek kompetencję poniżej dwóch punktów, natychmiast blokuje zapis — tak samo jak
przy tworzeniu. Po zapisie gracz wraca na tę samą stronę z potwierdzeniem i widzi skład odczytany
z bazy. Nazwy-hasha nie da się zmienić **żadną ścieżką**, bo rola `authenticated` ma przywilej
`update` wyłącznie na kolumnie `composition`.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Wejście w tryb edycji | `/teams/[id]` od razu edytowalne; `readOnly` usunięty | Realizuje FR-008 dosłownie i **likwiduje** parę przełączników z `lessons.md`, zamiast wymagać jej pilnowania. |
| Trasa zapisu | `POST /api/teams/[id]`, natywny formularz | Kopia wzorca `POST /api/teams` — zero JS, jeden kanał błędów przez `?error=`, zgodnie z konwencją AGENTS.md. |
| Po udanym zapisie | Redirect na `/teams/[id]?saved=1` | Gracz widzi zapisany skład tam, gdzie go zmieniał; `/teams/[id]/embark` zostaje potwierdzeniem **pierwszego** zapisu. |
| Następca `EmbarkGate` (F5) | Jeden `CompositionGate`, tryb z obecności `teamId` | Próg, `disabled` i komunikat FR-018 istnieją raz, więc bramka tworzenia i edycji nie mogą się rozjechać. |
| Niezmienność nazwy (FR-011) | Kolumnowy `grant update (composition)` | Baza odmawia zapisu każdej innej kolumny — jedna linijka DDL w stylu obrony w głąb, który migracje już stosują. |
| Porzucenie zmian | Brak przycisku „Discard" | Skład żyje wyłącznie w pamięci wyspy, więc wyjście ze strony już przywraca stan zapisany. |
| Follow-up F7 | Wydzielić `src/lib/team-composition.ts` teraz | Martwy punkt policzony: **jeden** importer, więc refaktor to jedna funkcja i jedna linia importu. |
| Testy | Regresja „próg działa w obie strony" | Główne ryzyko S-05 z roadmapy dostaje wykonywalny dowód w CI zamiast komentarza. |

## Zakres

**W zakresie:** migracja z polityką `update` i kolumnowym przywilejem; `updateTeam` w repo; wydzielenie
`team-composition.ts`; trasa `POST /api/teams/[id]`; test regresyjny progu edycji; `CompositionGate`;
usunięcie `readOnly` z `TeamComposer`; hydratacja i stany `?saved=1` / `?error=` na `/teams/[id]`.

**Poza zakresem:** edycja nazwy drużyny; wersje robocze; obsługa równoległej edycji w dwóch kartach
(wygrywa ostatni zapis); przycisk „Discard" i `beforeunload`; blokowanie zapisu przy braku zmian;
usuwanie drużyny (S-06, bez polityki `delete`); rozstrzygnięcie 404-vs-redirect dla cudzej drużyny
(S-07); testy komponentów React.

## Architektura / Podejście

```
/teams/[id].astro  ──(client:load)──►  TeamComposer(teamId)  ──►  CompositionGate(teamId)
       │                                       │                          │ POST (natywny formularz)
       │ getTeamDetail + getCharacterPool      │ evaluateTeam             ▼
       │ resolveSavedTeam (bramka spójności)   │ (blokada przycisku)   /api/teams/[id].ts
       │                                                                  │ gateTeamSubmission ← ta sama
       ▲                                                                  │ funkcja co POST /api/teams
       └──────── redirect ?saved=1 / ?error= ─────────────────────────────┴─► updateTeam ─► RLS + grant
                                                                                             (composition)
```

Sedno: tryb odczytu **znika**, a nie zyskuje przełącznik. Oba ekrany zapisują i różnią się wyłącznie
celem, wyrażonym jednym opcjonalnym propem `teamId` — dzięki czemu „edycja bez id" i „tworzenie z id"
są niereprezentowalne. Próg jest liczony w jednym miejscu dla obu kierunków.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Baza i warstwa danych | Migracja `update`, `updateTeam`, wydzielony `team-composition.ts` | Sam `using` bez `with check` przepuściłby przepisanie wiersza na cudze konto |
| 2. Trasa zapisu zmian | `POST /api/teams/[id]` + test regresyjny progu | Trasa z własną kopią reguły przepuściłaby edycję poniżej progu — Guardrail tylnymi drzwiami |
| 3. Ekran edycji | `CompositionGate`, `TeamComposer` bez `readOnly`, hydratacja `/teams/[id]` | Rozbicie fazy na commity daje awarię cichą, której nie łapie lint, typy ani testy |

**Wymagania wstępne:** S-04 zarchiwizowane; projekt Supabase zlinkowany (dla `supabase db push`);
konto testowe z co najmniej jedną zapisaną drużyną, a drugie konto do sprawdzenia izolacji.

**Szacowany wysiłek:** ~2 sesje w 3 fazach; fazy 1 i 2 są małe, faza 3 musi wejść w całości naraz.

## Otwarte ryzyka i założenia

- **Kolejność wdrożenia jest wiążąca**: kod fazy 3 na produkcji przed migracją daje przycisk
  „Save changes", który cicho nie zapisuje (zero wierszy, brak błędu) — czyli dokładnie ten tryb
  awarii, przed którym broni FR-009.
- **Faza 3 to jeden commit.** `client:load`, zdjęcie `readOnly` i podmiana bramki to jeden
  przełącznik rozłożony na trzy pliki (`context/foundation/lessons.md`).
- **Kolumnowy `grant update` daje mało czytelny błąd Postgresa** przy próbie zapisu innej kolumny,
  więc log w `updateTeam` musi nieść oryginalny `error.message`.
- **Założenie odziedziczone z S-04 (F8, nadal otwarte):** produkcyjny `SUPABASE_KEY` jest kluczem
  anon, nie `service_role`. Ten fragment **zwiększa stawkę** — `service_role` omijałby także nową
  politykę `update`, więc POST na cudze id faktycznie zmieniłby cudzy wiersz. Kontrola pozostaje
  przypisana do S-07; jeśli ma być przesunięta, to tutaj.
- **Zapis nietkniętego składu jest dozwolony** (przycisk aktywny bez zmian) — przyjęte świadomie
  jako no-op zamiast wprowadzania stanu „czy coś się zmieniło".

## Kryteria sukcesu (podsumowanie)

- Gracz zmienia skład zapisanej drużyny i po odświeżeniu strony widzi zmianę, a nazwa-hash jest ta sama.
- Usunięcie członka cofające próg blokuje zapis; ponowne domknięcie progu go odblokowuje — bramka
  działa w obie strony, z dowodem w testach CI.
- Drugie konto nie odczytuje ani nie zmienia cudzej drużyny żadną ścieżką, także przez POST wprost
  na `/api/teams/<cudze-id>`.
