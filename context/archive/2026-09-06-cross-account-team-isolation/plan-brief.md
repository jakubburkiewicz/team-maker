# Cudza drużyna jest niedostępna każdą ścieżką — Krótki plan

> Pełny plan: `context/changes/cross-account-team-isolation/plan.md`

## Co i dlaczego

S-07 domyka Guardrail „izolacja danych między kontami” (US-04, FR-004) — ostatni fragment pętli
CRUD kamienia milowego M-1. Wymaganie jest **własnością binarną**: liczba drużyn cudzego konta
widocznych lub modyfikowalnych ma wynosić zero, a jedna nieosłonięta trasa unieważnia całość.
Fragment został zaplanowany na koniec pętli celowo — dopiero gdy istnieją wszystkie cztery
operacje, da się wykazać zero na wszystkich czterech, a nie tylko na odczycie.

## Punkt wyjścia

**Mechanizm izolacji już stoi kompletny.** RLS pokrywa cztery operacje (`insert`/`select` z S-03,
`update` z S-05, `delete` z S-06), repo świadomie nie filtruje po `user_id` i zwraca `null`
nierozróżnialnie dla nieznanego id, cudzego wiersza i nie-UUID, a trasy API nie różnicują
komunikatu między „nie ma czego zapisać” a awarią zapytania. Brakuje trzech rzeczy: puste 404 bez
nawigacji (prowizorka z S-03), brak testu na barierze **odczytu** — czyli na rdzeniu US-04 —
i brak jakiegokolwiek dowodu, że całość działa na dwóch kontach.

## Pożądany stan końcowy

Odgadnięty lub cudzy identyfikator daje 404 z czytelnym ekranem („This team does not exist, or it
is not yours.”) i linkami do własnej listy — **identycznym** na obu trasach dynamicznych, więc
z odpowiedzi nie da się wywnioskować, czy wiersz istnieje. Każda z czterech operacji ma w CI
zakotwiczoną własną barierę SQL, a rozbrojenie RLS w przyszłej migracji zapala czerwony test.
Na produkcji, na dwóch kontach, macierz cztery operacje × dwie ścieżki kończy się zerem.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Cudze / nieznane id | 404 z pełną stroną, nie redirect | Zachowuje mechanizm z lekcji S-03 (żadnego top-level `return`, żadnego ręcznego `Location`), jest uczciwe dla zakładki po skasowanej drużynie i dokłada nawigację, której żądała roadmapa | Plan |
| Kształt ekranu | Wspólny `TeamNotFound.astro` renderujący własny `Layout` | Treść to jedyna rzecz, która nie może się rozjechać między trasami — różnica ujawniałaby istnienie rekordu; jedno źródło zamiast dwóch kopii | Plan |
| Komunikat | „This team does not exist, or it is not yours.” | Forma łączna nazywa regułę izolacji dla persony recenzenta, nie zdradzając, który z trzech przypadków zaszedł | Plan |
| Druga bariera w kodzie | Nie — RLS zostaje jedyną | Filtr `.eq("user_id", …)` maskowałby awarię polityki i czyniłby dowód dwukontowy nierozstrzygającym | Plan |
| Zakres testów SQL | Domknąć macierz 4 operacji + strażnicy negatywni | `enable row level security` jest pojedynczym punktem, którego zdjęcie rozbraja wszystkie cztery polityki naraz — bez sygnału z lintera, typów ani kodu | Plan |
| Miejsce dowodu | Macierz w planie + `## Progress` | Dowód leży tam, gdzie działa cały łańcuch: `/10x-implement` odhacza, `/10x-impl-review` weryfikuje | Plan |
| Środowisko dowodu | Produkcja | Zielony przebieg empirycznie wyklucza klucz `sb_secret_` i tym samym pochłania follow-up F8 z przeglądu S-04 | Plan |
| Follow-up F2 | W zakresie | Jednolinijkowa poprawka przypisana imiennie do S-07; `delete.ts` ma już wzór, a rozjazd bliźniaczych tras jest kosztowniejszy niż poprawka | Plan |

## Zakres

**W zakresie:**
- Wspólny ekran 404 z nawigacją na `/teams/[id]` i `/teams/[id]/embark`
- `encodeURIComponent(params.id)` w `src/pages/api/teams/[id].ts` (follow-up F2)
- Pięć nowych asercji w `teams-policy-sql.test.ts`: polityka `select`, polityka `insert`,
  `enable row level security`, plus strażnicy na `disable row level security` i `drop policy`
- Ręczny przebieg dwukontowy na produkcji, cztery operacje × dwie ścieżki

**Poza zakresem:**
- Redirect na listę i parametr `?missing=1` — odrzucone na rzecz 404
- Jakikolwiek `.eq("user_id", …)` w `src/lib/team-repo.ts`
- Nowe migracje; `supabase/` musi wyjść z diffu nietknięty
- Zmiany w `PROTECTED_ROUTES` (prefiks `/teams` nadochrania, ale nie przecieka)
- Audyt kompletności tras i osobna pozycja na F8 (pochłania ją Faza 3)
- Przepisanie `teams-policy-sql.test.ts` na macierz generatywną
- Testy komponentów React i E2E — Moduł 3

## Architektura / Podejście

Nic nowego w warstwie ochrony: bariera zostaje jedna i leży w SQL. Zmiana dotyka trzech warstw
niezależnie — prezentacji (jeden komponent `.astro` renderowany przez dwie strony w gałęzi
`notFound`, status `404` bez zmian), weryfikacji (asercje nad tekstem migracji, czytane przez
`node:fs`, bez stosu Astro i Supabase) oraz dowodu (przebieg ręczny na wdrożonej aplikacji).
Trzy warstwy nie zależą od siebie mechanicznie; wiąże je kolejność faz.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Ekran „nie znaleziono” + F2 | Wspólny `TeamNotFound.astro` na obu trasach, `encodeURIComponent` w trasie zapisu | Top-level `return` w `.astro` wywraca `npm run lint` (lekcja S-03) — mechanizm musi zostać na `Astro.response.status` |
| 2. Kotwice SQL | Pięć asercji domykających macierz czterech operacji plus strażnicy przed rozbrojeniem RLS | Test, który nie czerwienieje po zdjęciu `enable rls`, jest dekoracją — stąd obowiązkowa kontrola mutacyjna |
| 3. Dowód dwukontowy | Przebieg macierzy na produkcji; zamknięcie F8 | `checkOrigin` zwraca 403 dla POST-a z obcego origin **zanim** dotknie RLS — przebieg wyglądałby na zielony, nie dowodząc niczego |

**Wymagania wstępne:** S-05 i S-06 zarchiwizowane (są). Dostęp do wdrożenia
(`npx wrangler deploy`) i dwa adresy e-mail zdolne odebrać link potwierdzający — potwierdzanie
na produkcji jest włączone.
**Szacowany wysiłek:** ~2 sesje. Fazy 1 i 2 to mały diff (jeden nowy komponent, cztery dotknięte
pliki); Faza 3 jest w całości ręczna i zajmuje najwięcej czasu zegarowego.

## Otwarte ryzyka i założenia

- **`checkOrigin` może dać fałszywie zielony wynik w krokach 3.7 i 3.8.** Spreparowany POST musi
  iść z origin aplikacji, inaczej Astro odrzuci go jako CSRF, zanim dojdzie do RLS. Każdy krok
  macierzy notuje kod odpowiedzi; `403` znaczy „powtórz”, nie „przeszło”.
- **Dowód jest punktowy, nie ciągły.** Zielona Faza 3 mówi o stanie w chwili przebiegu.
  Weryfikacja klucza `sb_publishable_` została w S-05 nazwana „warunkiem stałym” — każda podmiana
  sekretu unieważnia dowód, a nic w repozytorium tego nie przypomni.
- **Testy SQL dowodzą treści migracji, nie zachowania bazy.** Zielony `npm test` nie jest dowodem
  US-04; założenie „zastosowana migracja odpowiada plikowi” weryfikuje dopiero Faza 3.
- **Kontrola mutacyjna dotyka zastosowanej migracji.** Zmiana jest lokalna i cofana
  (`git checkout -- supabase/`), ale krok 2.8 musi to potwierdzić — migracja raz wypchnięta
  na produkcję jest niezmienna.

## Kryteria sukcesu (podsumowanie)

- Gracz z odgadniętym identyfikatorem widzi czytelny ekran 404 z drogą powrotu, identyczny na obu
  trasach — zamiast białej strony.
- Konto B nie odczytało, nie zmieniło ani nie skasowało żadnej drużyny konta A na produkcji,
  żadną z ośmiu ścieżek macierzy; konto A po przebiegu ma drużynę w stanie niezmienionym.
- Przyszła migracja rozbrajająca RLS lub kasująca politykę zapala czerwony test w CI.
