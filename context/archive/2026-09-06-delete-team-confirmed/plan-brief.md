# Usunięcie drużyny po potwierdzeniu — Krótki plan

> Pełny plan: `context/changes/delete-team-confirmed/plan.md`

## Co i dlaczego

Gracz otwiera własną drużynę, wybiera usunięcie i potwierdza je w oknie dialogowym; rezygnacja
zostawia drużynę nietkniętą, a usunięcie ostatniej przywraca stan pusty z wezwaniem do utworzenia
nowej (US-03, FR-010). To czwarta i ostatnia operacja CRUD — dopiero ona domyka pierwsze Kryterium
sukcesu PRD: „wszystkie cztery operacje CRUD są wykonalne z interfejsu".

## Punkt wyjścia

Baza jest **celowo** zamknięta na usuwanie: `20260905185700_teams_schema.sql:46` cofnął przywilej
`delete` i nie ma polityki `for delete`, więc dziś usunięcie przechodzi bez błędu i kasuje zero
wierszy. Ta granica zakresu jest zapisana jako czerwony test (`teams-policy-sql.test.ts:77-82`),
który ten fragment ma rozbroić. Poza tym wszystko potrzebne stoi: `/teams` z listą i stanem pustym
(S-04), `/teams/[id]` z hydratowanym kompozytorem, slotem `<ServerError>` i banerem `?saved=1`,
oraz świeży wzorzec drugiego pisarza `POST /api/teams/[id]` (S-05).

## Pożądany stan końcowy

Na `/teams/<id>` stoi przycisk „Delete team", który otwiera modalne `role="alertdialog"` nazywające
drużynę po nazwie-hashu i mówiące wprost, że operacji nie da się cofnąć. Potwierdzenie wysyła
natywny formularz na `POST /api/teams/<id>/delete` i odsyła na `/teams?deleted=1` z zielonym banerem
— nad listą albo nad stanem pustym, jeśli to była ostatnia drużyna. Cudze i nieistniejące id dają
ten sam komunikat co awaria, więc nie powstaje kanał enumeracji.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego |
| --- | --- | --- |
| Umiejscowienie akcji | Tylko `/teams/[id]` | Strona ma już `client:load`; przycisk na liście otwierałby nową granicę hydratacji na stronie, która dziś nie wysyła ani bajta JS. |
| Prymityw okna | shadcn `alert-dialog` | `role="alertdialog"` i brak zamykania kliknięciem w tło to właściwość, nie ozdoba, dla jedynej ochrony operacji nieodwracalnej. |
| Kształt trasy | Nowy `POST /api/teams/[id]/delete` | Natywny formularz nie zna czasownika DELETE, a rozgałęzianie istniejącego POST przepuściłoby usuwanie przez bramkę progu. |
| Przekierowania | Sukces → `/teams?deleted=1`, odmowa → `/teams/<id>?error=` | Odmowa wpada w istniejący slot `<ServerError>` — zero nowej powierzchni błędu. |
| Kontrakt repo | `TeamSummary \| null \| throw` | Identyczny z `updateTeam`: zero wierszy to nie awaria, ale gracz widzi ten sam komunikat co przy awarii (US-04). |
| Test SQL | Asercje pozytywne + strażnik `truncate`/`anon` | RLS nie dotyczy TRUNCATE — filtruje go wyłącznie przywilej, więc strażnik musi zostać, gdy zdejmujemy ten od `delete`. |
| Postać przycisku | Osobna wyspa `DeleteTeamDialog` | `TeamComposer` dopiero co pozbył się trybu `readOnly`; warunkowy przycisk przywracałby ten sam problem inną drogą. |
| Umiejscowienie banera | Nad stanem pustym **i** listą | Usunięcie ostatniej drużyny kończy się stanem pustym — i tam potwierdzenie jest najbardziej potrzebne. |

## Zakres

**W zakresie:** migracja z polityką `for delete` i tabelowym `grant delete` · `deleteTeam`
w `team-repo.ts` · przepisany `teams-policy-sql.test.ts` · trasa `POST /api/teams/[id]/delete` ·
prymityw `alert-dialog` · wyspa `DeleteTeamDialog` na `/teams/[id]` · baner `?deleted=1` na `/teams`.

**Poza zakresem:** przycisk usuwania na liście · miękkie usuwanie, kosz i przywracanie (Non-Goal) ·
rozstrzygnięcie 404 vs redirect dla cudzego id (S-07) · slot `<ServerError>` na liście · zmiany
w `TeamComposer`, `CompositionGate` i bramce progu · zmiany w `src/middleware.ts` · wydzielenie
`src/lib/team-composition.ts` (follow-up F7 zostaje follow-upem).

## Architektura / Podejście

```
AlertDialog (wyspa, client:load na /teams/[id])
  └─ <form method="post" action="/api/teams/<id>/delete">   ← wewnątrz portalu Radix
        │
        ▼
POST /api/teams/[id]/delete          5 gałęzi, każda = context.redirect
        │  brak ciała, brak bramki progu
        ▼
deleteTeam(supabase, params.id)      TeamSummary | null | throw
        │
        ▼
polityka "owner can delete teams" using (user_id = (select auth.uid()))
        │
   sukces ──► /teams?deleted=1  (baner nad listą lub stanem pustym)
   null/throw ──► /teams/<id>?error=…  (istniejący <ServerError>)
```

Kolejność „od bazy do ekranu", ta sama co w S-05: baza dostaje przywilej, zanim istnieje wywołujący;
trasa jest sprawdzalna `curl`-em, zanim istnieje przycisk.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Baza i warstwa danych | Migracja + `deleteTeam` + przepisany test SQL; zero zmian w UI | Przywilej `delete` nadany zanim potwierdzono, że produkcyjny klucz nie omija RLS — stąd warunek stały w kryteriach ręcznych |
| 2. Trasa usuwania | `POST /api/teams/[id]/delete`, sprawdzalna `curl`-em | Rozjazd komunikatów między `null` a `throw` otworzyłby kanał enumeracji cudzych id |
| 3. Ekran | `alert-dialog` + wyspa + osadzenie + baner, **jednym commitem** | Formularz poza portalem Radix daje przycisk, który cicho nic nie robi; wyspa bez `client:load` — to samo |

**Wymagania wstępne:** S-04 (`own-teams-list-and-detail`) i S-05 (`edit-saved-team`), oba
zarchiwizowane 2026-09-06. Dostęp do `supabase db push` i do produkcyjnego `SUPABASE_KEY`.

**Szacowany wysiłek:** ~2 sesje w 3 fazach; Faza 3 jest największa, bo wchodzi jednym commitem.

## Otwarte ryzyka i założenia

- **Cała izolacja stoi na RLS + kluczu publikowalnym.** `team-repo.ts` świadomie nie filtruje po
  `user_id`. Przy operacji nieodwracalnej klucz `sb_secret_` znaczy „kasowanie cudzych drużyn", nie
  „czytanie". Ryzyko z przeglądów S-04 (F8) i S-05 (F1), sprawdzane przed Fazą 2.
- **Kontrakt `TeamSummary | null` zależy od polityki `select`** — `delete … returning` przechodzi
  przez nią. Zmiana tej polityki w przyszłości rozbroiłaby rozróżnienie bez żadnego błędu.
- **Generator shadcn bywa niezgodny z repo.** Korekta importów po `npx shadcn add` jest wymuszona
  lekcją, ale to nadal krok ręczny, którego nie łapie ani lint, ani typy przed uruchomieniem.
- **Założenie:** `src/pages/api/teams/[id]/delete.ts` obok `[id].ts` nie koliduje w Astro 6.3.1 —
  ekwiwalent po stronie stron (`teams/[id].astro` obok `teams/[id]/embark.astro`) był sondowany
  w S-04, ale nie po stronie tras API. Weryfikuje to `npm run build` w Fazie 2.

## Kryteria sukcesu (podsumowanie)

- Gracz usuwa własną drużynę po potwierdzeniu, a rezygnacja z okna zostawia ją nietkniętą.
- Usunięcie ostatniej drużyny kończy się stanem pustym z wezwaniem do utworzenia nowej, a nie
  zerem wyników — z widocznym potwierdzeniem, że operacja się udała.
- Konto A nie może usunąć drużyny konta B żadną ścieżką, także bezpośrednim POST z odgadniętym id,
  i nie dowiaduje się z odpowiedzi, czy takie id istnieje.
