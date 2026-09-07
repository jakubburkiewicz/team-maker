# Refresh test-plan.md — reguła czystości w runtime i odpowiedź na izolację bez Postgresa — plan implementacji

## Przegląd

`context/foundation/test-plan.md` cytuje twardą regułę, która została przepisana. 2026-09-07
commitem `62a6f68` reguła czystości testów w `AGENTS.md` przeszła z kryterium tekstowego
(„nic pod testem nie może importować `astro:*` ani `@/lib/supabase`") na kryterium faktyczne
(„liczy się, co ewaluuje się w runtime testu"). Przewodnik nadal niesie starą literę w czterech
miejscach, w jednym z nich (§6.1) jako **instrukcję dla piszącego test**, a w trzech innych
(§2 wiersze #1 i #2, §4 wiersz integration) nazywa wynikające z niej pytanie **otwartym**, choć
zostało rozstrzygnięte.

Drugi wątek: badanie Fazy 1 ustaliło, że prawdziwy Postgres jest poza zasięgiem CI
(`.github/workflows/ci.yml:21` — gołe `npm test`, bez `services:`, bez `env:`, bez Dockera;
lokalny stos wymaga ręcznego `npx supabase start` i ~7 GB RAM). Przewodnik w trzech miejscach
opiera odpowiedź na ryzyko #2 właśnie o niego.

Ten refresh sprowadza przewodnik do stanu faktycznego. **Nie zmienia strategii** — sześć ryzyk,
§7 przestrzeń negatywna i kolejność faz zostają nietknięte. Zmienia się wyłącznie to, co
przewodnik twierdzi o wykonalności i koszcie odpowiedzi.

## Analiza bieżącego stanu

Miejsca niosące obalone twierdzenia, zweryfikowane grepem nad bieżącym plikiem:

| Linia | Sekcja | Obalone twierdzenie |
|---|---|---|
| 47 | §2 ryzyko #1 | brzmienie sugeruje szerszą powierzchnię ataku, niż istnieje |
| 67 | §2 *Response* #1, kolumna kontekstu | „**jak pogodzić test wykonawczy z regułą czystości testów**" jako pytanie otwarte |
| 68 | §2 *Response* #2 | „czy da się wykonać zapytanie bez łamania czystości testów" jako pytanie otwarte; „integracja przeciwko **prawdziwemu Postgresowi**" jako najtańsza warstwa |
| 83 | §3 Faza 2, kolumny *Goal* i *Test types* | `integration (real Postgres, two identities)` |
| 89 | §3 *Uzasadnienie kolejności* | „Faza 1 … **przy okazji rozstrzyga** strukturalne pytanie o pogodzenie testu wykonawczego z regułą czystości testów — czym odblokowuje Fazę 2" |
| 110 | §4 wiersz integration | „**Wymaga rozstrzygnięcia**, jak pogodzić wykonanie z regułą czystości testów" |
| 118 | §4 *Ograniczenia twarde* | stara litera reguły, cytowana jako obowiązująca |
| 153 | §6.1 *Czystość* | stara litera **plus instrukcja** „wydziel czysty rdzeń" |
| 165 | §6.3 placeholder | „wykonywany przeciwko **prawdziwemu Postgresowi**" |

Dwa z nich (`153`, oraz człon o czystości w `68`) nie są wymienione w `change.md` — zostały
znalezione grepem w trakcie planowania i wchodzą do zakresu na mocy decyzji użytkownika
„wszędzie, gdzie żyje obalone zdanie".

Fakty gruntujące, wszystkie z `context/changes/2026-09-07-testing-save-barrier/research.md`:

- `AGENTS.md:11` — obowiązująca reguła: kryterium to ewaluacja w runtime testu. Wprost dopuszczone:
  `import type` z `"astro"`, `node:fs`, oraz plik importujący `@/lib/supabase` pod testem, o ile
  test podmienia ten moduł hoistowanym `vi.mock`. Wprost zakazane: budowanie prawdziwego klienta.
- research §7 — sonda empiryczna: `vi.mock("@/lib/supabase")` przeprowadza całą sekwencję trasy
  `POST /api/teams` do redirectu, bez zmian w konfiguracji Vitest. Wykonanie jest technicznie
  trywialne; problem był wyłącznie normatywny i został rozstrzygnięty.
- research §6 — `SUPABASE_KEY` to `context: "server", access: "secret"` (`astro.config.mjs:29`);
  zero trafień na `supabase`/`createClient` w `src/components/` i `src/layouts/`. Klucz nie trafia
  do przeglądarki, więc bezpośredni zapis przez PostgREST nie jest ścieżką dostępną recenzentowi.
  Realna powierzchnia ryzyk #1 i #6 to **spreparowane żądanie HTTP do własnej trasy aplikacji
  z ważnym ciasteczkiem sesji**.
- research §5 — baza egzekwuje wyłącznie własność (4 polityki RLS) i niezmienność nazwy; progu
  i limitów w SQL nie ma świadomie. Jedyną barierą progu jest Worker.
- research §7, ostatni punkt — `ci.yml:21` woła gołe `npm test`; sekrety przypięte wyłącznie do
  `npm run build` (`:22-25`).
- research *Historical Context* — `context/archive/2026-09-06-cross-account-team-isolation/plan.md:56-58`
  twierdzi „**Dowodu nie ma.** AGENTS.md wymusza czyste testy… izolacji cross-account nie da się
  zautomatyzować w Vitest". Ta przesłanka już nie obowiązuje, a §3 Faza 2 była pod nią zakresowana.
  Archiwum jest niezmienne (`AGENTS.md`) — nie poprawiamy go; poprawiamy przewodnik, który się
  na nim opierał.

## Pożądany stan końcowy

Przewodnik przeczytany wyrywkowo — jedna sekcja, jeden wiersz tabeli — nie prowadzi czytelnika
do obalonego wniosku. Konkretnie:

- Każde miejsce cytujące regułę czystości cytuje kryterium runtime i zgadza się z `AGENTS.md:11`.
- Żadne miejsce nie nazywa pytania o pogodzenie testu wykonawczego z regułą czystości **otwartym**.
- Odpowiedź na ryzyko #2 nazywa wprost granicę: co udowodni bramka automatyczna w CI, a co zostaje
  dymem ręcznym przeciwko lokalnemu stosowi — bez sugerowania, że Postgres w CI jest dostępny.
- Brzmienie ryzyka #1 nazywa faktyczną powierzchnię ataku.
- §2 kolumna anty-wzorców wierszy #1, #2 i #6 ostrzega przed cichym rozjazdem ręcznie pisanej
  atrapy klienta.
- §8 datuje refresh i nazywa jego wyzwalacz.

Weryfikacja: grep nad plikiem nie znajduje ani frazy o prawdziwym Postgresie, ani starej litery
reguły; §3 kolejność faz, sześć ryzyk §2 i pięć wykluczeń §7 są bit-w-bit takie jak przed
refreshem poza wskazanymi komórkami.

### Kluczowe odkrycia

- `context/foundation/test-plan.md:153` (§6.1) — **jedyne miejsce, które nie tylko cytuje obaloną
  regułę, ale nakazuje działanie wedle niej**: „Jeśli import jest potrzebny, wydziel czysty rdzeń".
  To opcja (c) z research §7, o której badanie mówi wprost, że „glue trasy zostaje niepokryty…
  **dziura przesuwa się o piętro**". Reguła jej już nie wymusza; jako domyślna rada jest szkodliwa.
- `context/foundation/test-plan.md:68` — wiersz #2 niesie **oba** obalone twierdzenia naraz
  (otwarte pytanie o czystość **i** prawdziwy Postgres). `change.md` wymienia tylko drugie.
- `context/foundation/test-plan.md:89` — akapit uzasadnienia kolejności opiera odblokowanie Fazy 2
  o rozstrzygnięcie, którego Faza 1 miała dopiero dokonać. Rozstrzygnięcie zapadło **przed** Fazą 1,
  w jej badaniu. Sam wniosek („Faza 2 jest odblokowana") stoi; upada tylko jego przyczyna.
- `.github/workflows/ci.yml:18-25` — potwierdzone bezpośrednio: `npm test` bez `env:` i bez
  `services:`, a sekrety przypięte wyłącznie do `npm run build`.
- `AGENTS.md` — „Never write to `context/archive/`". Fałszywa teza z archiwum
  (`2026-09-06-cross-account-team-isolation/plan.md:56-58`) **zostaje w archiwum nietknięta**;
  refresh unieważnia ją tylko w przewodniku.

## Czego NIE robimy

- **Nie ruszamy sześciu ryzyk §2.** Decyzja użytkownika w `change.md`: te same ryzyka, tylko
  odpowiedź stała się tańsza. Zmienia się brzmienie ryzyka #1 (zawężenie powierzchni) i komórki
  w *Risk Response Guidance* — nie lista, nie oceny Impact/Likelihood, nie kolumna Źródło.
- **Nie ruszamy §7 przestrzeni negatywnej.** Użytkownik potwierdził, że wszystkie pięć wykluczeń
  nadal obowiązuje.
- **Nie ruszamy §1 Strategy** ani kolejności faz w §3. Anty-wzorzec fake-drift ląduje w kolumnie
  anty-wzorców §2, nie w §1 (decyzja użytkownika).
- **Nie ruszamy cytatów hot-spotów w §2.** Przeskanowane ponownie 2026-09-07, niezmienione.
- **Nie wypełniamy §6.2–§6.6 treścią.** Zostają placeholderami `TBD — see §3 Phase <N>`;
  z §6.3 znika wyłącznie obalone twierdzenie o Postgresie, nie sam placeholder.
- **Nie piszemy żadnego kodu testowego, nie tworzymy przegród w `vitest.config.ts`, nie dotykamy
  `ci.yml`.** To jest refresh dokumentu. Wybór między opcjami (a)/(b)/(c)/(d) z research §7 należy
  do `/10x-plan` Fazy 1, nie tutaj.
- **Nie poprawiamy `context/archive/`.** Niezmienne z twardej reguły.
- **Nie dodajemy siódmego ryzyka** za fake-drift — decyzja użytkownika w `change.md`.

## Podejście do implementacji

Cztery fazy w kolejności od źródła korekty do jej konsekwencji: najpierw §4, gdzie mieszka cytat
z `AGENTS.md` (faza 1); potem §2, gdzie mieszka odpowiedź na ryzyka (faza 2); potem propagacja do
sekcji, które się o §2 i §4 opierają (faza 3); na końcu stempel i kontrola, że nic obalonego nie
przetrwało (faza 4).

Kolejność nie jest dowolna: §2 wiersz #2 przeformułowuje się **wobec** granicy CI/ręczne, a ta
granica bierze się z kryterium runtime zapisanego w §4. Odwrotna kolejność wymagałaby dwukrotnego
dotknięcia tych samych komórek.

Wszystkie edycje są w jednym pliku i wszystkie są zamianami istniejącego tekstu — żadna nie dodaje
nowej sekcji ani nie zmienia struktury nagłówków.

## Faza 1: §4 Stack — reguła czystości i wiersz integration

### Przegląd

Wymiana cytowanej reguły na obowiązujące kryterium runtime i przestawienie wiersza
„integration (trasy, baza)" z pytania otwartego na rozstrzygnięcie. To korekty 1 i 2 z `change.md`.

### Wymagane zmiany

#### 1. Akapit „Ograniczenia twarde wiążące wybór warstw"

**Plik**: `context/foundation/test-plan.md` (§4, akapit zaczynający się „Ograniczenia twarde
wiążące wybór warstw (`AGENTS.md`)", obecnie linie 117–122)

**Cel**: przewodnik ma cytować regułę obowiązującą, nie tę sprzed commita `62a6f68`. Fragment
o czystości testów zastępujemy kryterium runtime; pozostałe cztery ograniczenia w tym akapicie
(`zod`, `wrangler dev`, `supabase config push`, rozjazd potwierdzania e-mail) zostają dosłownie —
żadne z nich się nie zmieniło.

**Kontrakt**: nowe brzmienie fragmentu o czystości musi nieść **cztery** elementy, wszystkie
obecne w `AGENTS.md:11`, bo każdy z nich rozstrzyga inny wybór warstwy:

1. kryterium jest **runtime**, nie treść linii importu — nic pod testem nie może **ewaluować**
   modułu rozwiązującego `astro:*` ani konstruować prawdziwego klienta Supabase;
2. `import type` z `"astro"` jest w porządku (kasowany przy transpilacji);
3. `node:fs` jest w porządku (precedens: `src/lib/teams-policy-sql.test.ts`);
4. plik importujący `@/lib/supabase` **może** być pod testem, o ile test podmienia ten moduł
   hoistowanym `vi.mock` — a prawdziwego klienta nadal nie wolno zbudować; atrapa idzie jako
   argument, który moduły `src/lib/` już przyjmują.

Punkt 4 jest tym, który odblokowuje warstwę integracyjną, więc nie może zostać zwinięty do
„reguła się zmieniła". Zachowaj odsyłacz do `AGENTS.md` jako źródła — przewodnik cytuje regułę,
nie jest jej właścicielem.

#### 2. Wiersz tabeli §4 „integration (trasy, baza)"

**Plik**: `context/foundation/test-plan.md` (§4, linia 110)

**Cel**: kolumna *Notes* nazywa dziś pytanie otwartym („Wymaga rozstrzygnięcia, jak pogodzić
wykonanie z regułą czystości testów"). Ma nazwać rozstrzygnięcie i to, co ono odblokowuje.

**Kontrakt**: kolumny *Tool* i *Version* zostają (`none yet — see Phase 1 i Phase 2`, `—`) —
narzędzia faktycznie nadal nie ma, zmieniła się tylko wykonalność. Kolumna *Notes* ma powiedzieć:
rozstrzygnięte 2026-09-07 — wykonanie trasy w Vitest jest zgodne z regułą, gdy `@/lib/supabase`
jest podmieniony hoistowanym `vi.mock`; sonda w badaniu Fazy 1 przeprowadziła całą sekwencję
`POST /api/teams` bez zmian w konfiguracji. Konsekwencja: warstwa integracyjna nie potrzebuje ani
nowego runnera, ani przegrody w `vitest.config.ts`, ani zmiany `ci.yml`. Nie rozstrzygaj tu, którą
z opcji (a)/(b)/(d) wybierze Faza 1 — zapisz, że wykonanie jest osiągalne, a wybór należy do fazy.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Stara litera zniknęła z §4: grep na `może importować` nie zwraca linii z §4
  (przed zmianą trafia w 118 i 153; fraza `nie może importować` **nie** trafia w §4 —
  stara litera jest tam zawinięta przez łamanie wiersza między 117 a 118)
- Nowe kryterium runtime jest obecne w §4
- Wiersz integration nie nazywa już pytania otwartym: grep na `Wymaga rozstrzygnięcia` zwraca pusto
- Prettier nie zgłasza zmian: `npx prettier --check context/foundation/test-plan.md`
- Tabela stosu §4 nadal ma 7 wierszy

#### Weryfikacja ręczna

- Fragment o czystości testów w §4 zgadza się co do treści z `AGENTS.md:11` — cztery elementy
  kontraktu obecne, żaden nie zwinięty
- Cztery pozostałe ograniczenia twarde w tym akapicie (`zod`, `wrangler dev`, `supabase config push`,
  rozjazd potwierdzania e-mail) są nietknięte
- Wiersz integration nie przesądza wyboru opcji wykonania za Fazę 1

**Uwaga implementacyjna**: po tej fazie i przejściu weryfikacji automatycznej zatrzymaj się
i poczekaj na ręczne potwierdzenie, zanim przejdziesz do Fazy 2. Bloki faz używają zwykłych
punktorów; pola wyboru są w sekcji `## Progress`.

---

## Faza 2: §2 Risk Map — zawężenie #1, granica dla #2, anty-wzorce

### Przegląd

Cztery korekty w §2: zawężenie brzmienia ryzyka #1 (korekta 5), zdjęcie zgruntowanego pytania
z kolumny kontekstu wierszy #1 **i #2** (korekta 3, rozszerzona o wiersz #2), przeformułowanie
najtańszej warstwy dla #2 na granicę CI/ręczne (korekta 4), oraz dopisanie anty-wzorca fake-drift
do wierszy #1, #2 i #6.

### Wymagane zmiany

#### 1. Brzmienie ryzyka #1 w tabeli Risk Map

**Plik**: `context/foundation/test-plan.md` (§2, linia 47, kolumna *Risk (failure scenario)*)

**Cel**: obecne brzmienie („bo pilnował go przycisk, a trasa zapisu już nie") czytane razem
z cytatem PRD „reguła obowiązuje także poza interfejsem" sugeruje powierzchnię szerszą niż
faktyczna. Badanie zweryfikowało, że bezpośredni zapis przez PostgREST nie jest dostępny.

**Kontrakt**: ryzyko pozostaje tym samym scenariuszem awarii w kategoriach użytkownika i zachowuje
ocenę High × High oraz pozycję pierwszą. Zmienia się wyłącznie nazwanie kanału: powierzchnią jest
**spreparowane żądanie HTTP do trasy aplikacji z ważnym ciasteczkiem sesji**, nie zapis do bazy
z pominięciem aplikacji. Kolumna *Source* zostaje **bez zmian** — cytat PRD „także poza interfejsem"
jest dosłownym cytatem dokumentu źródłowego i nie wolno go przepisywać; zawężenie należy do kolumny
opisu ryzyka, nie do cytatu. Nie wprowadzaj kotwic plik:linia — §1 zasada #3 tego zabrania w §2.

#### 2. Kolumna „Context `/10x-research` must ground" w wierszach #1 i #2

**Plik**: `context/foundation/test-plan.md` (§2 *Risk Response Guidance*, linie 67 i 68)

**Cel**: obie komórki nazywają dziś otwartym to samo pytanie o pogodzenie wykonania z regułą
czystości. Jest zgruntowane — badanie Fazy 1 je rozstrzygnęło, a `AGENTS.md` utrwalił.

**Kontrakt**: z wiersza #1 znika człon „**jak pogodzić test wykonawczy z regułą czystości testów
z `AGENTS.md`**"; pozostałe trzy człony tej komórki (punkt wejścia zapisu; czy tor woła regułę
progu przed utrwaleniem; kształt odmowy) zostają. Z wiersza #2 znika człon „czy da się wykonać
zapytanie bez łamania czystości testów"; pozostałe trzy (realny tor żądania dla czterech operacji;
czym jest tożsamość w zapytaniu; jak postawić dwa konta w teście) zostają — te są nadal otwarte
i to jest praca badania Fazy 2. Nie zastępuj usuniętych członów niczym; kolumna ma być listą tego,
co **jeszcze** wymaga ugruntowania.

#### 3. Kolumna „Likely cheapest layer" w wierszu #2

**Plik**: `context/foundation/test-plan.md` (§2 *Risk Response Guidance*, linia 68)

**Cel**: „integracja przeciwko prawdziwemu Postgresowi (dwie tożsamości)" opisuje warstwę, której
CI nie ma i mieć nie będzie. Zastępujemy ją granicą przyjętą przez użytkownika.

**Kontrakt**: komórka ma wyrazić **dwuczłonową** odpowiedź, nie jedną warstwę:

- **w CI, bramka automatyczna**: wykonanie toru żądania dla czterech operacji na atrapie klienta —
  dowód, że trasa zawsze zawęża zapytanie do tożsamości z sesji i nigdy nie wypuszcza wiersza
  cudzego konta;
- **lokalnie / ręcznie**: sam efekt polityk RLS przeciwko prawdziwemu Postgresowi, bo `ci.yml:21`
  woła gołe `npm test` bez `services:`, bez `env:` i bez Dockera.

Zapisz też konsekwencję, która z tego wynika: rozbrojenie polityki RLS w migracji przejdzie w CI
na zielono — dlatego dym ręczny nie jest tu opcjonalnym dodatkiem.

#### 3b. Kolumna „What would prove protection" w wierszu #2

**Plik**: `context/foundation/test-plan.md` (§2 *Risk Response Guidance*, linia 68, kolumna 2)

**Cel**: komórka mówi dziś „sprawdzone **wykonaniem zapytania**, nie odczytem SQL-a". Po tym
refreshie bramka automatyczna w CI żadnego zapytania do bazy nie wykonuje — idzie na ręcznie
pisanej atrapie klienta. Zostawiona bez zmian, komórka obiecuje czytelnikowi wiersza #2 dowód,
którego automat nie dostarcza, i jest sprzeczna z sąsiednią kolumną najtańszej warstwy.

**Kontrakt**: sedno komórki zostaje — dowodem jest **wykonanie, nie odczyt SQL-a**; to jest lekcja
z `lessons.md`, której nie wolno rozmyć. Zmienia się to, **czym** jest wykonanie w każdym z dwóch
członów: bramka automatyczna wykonuje **tor żądania** dla czterech operacji (konto A na
identyfikatorze konta B dostaje zero wierszy albo odmowę, tożsamość brana z sesji, klient
podmieniony atrapą), a dym lokalny wykonuje **zapytanie do prawdziwej bazy** i dowodzi samego
efektu polityk RLS. Oba człony mają być w tej komórce nazwane; żaden nie może zostać zwinięty do
„sprawdzone wykonaniem". Nie zmieniaj kolumn *Must challenge* i *Source* — anty-wzorzec grepowania
po SQL-u zostaje dosłownie.

#### 4. Kolumna „Anti-pattern to avoid" w wierszach #1, #2 i #6

**Plik**: `context/foundation/test-plan.md` (§2 *Risk Response Guidance*, wiersze #1, #2, #6)

**Cel**: odpowiedź na te trzy ryzyka będzie się opierać o ręcznie pisaną atrapę klienta Supabase.
Atrapa może cicho rozjechać się z zachowaniem prawdziwej bazy, więc zielony test na niej nie jest
sam w sobie dowodem. `change.md` przesądza: anty-wzorzec, nie siódme ryzyko.

**Kontrakt**: do istniejącej treści każdej z trzech komórek **dopisujemy** człon (nie zastępujemy —
obecne anty-wzorce zostają: lustro implementacji dla #1, rozbudowa strażnika grepowego dla #2,
osobna infrastruktura dla #6). Dopisywany człon ma powiedzieć: atrapa klienta pisana ręcznie może
w ciszy rozjechać się z zachowaniem prawdziwej bazy, więc zielony test na atrapie nie jest dowodem,
dopóki nie wykazano czerwieni na wariancie rozbrajającym. Powiąż to z §1 zasadą przekrojową, która
już to wiąże — człon ma być jej zastosowaniem do konkretnego przypadku atrapy, nie nową regułą.
Trzy kopie mają być spójne co do treści; nie różnicuj ich brzmienia poza dopasowaniem do wiersza.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Fraza o prawdziwym Postgresie zniknęła z §2 wiersza #2
- Zgruntowane pytanie zniknęło z obu wierszy: grep na `bez łamania czystości testów` oraz
  `jak pogodzić test wykonawczy` zwraca pusto
- Tabela Risk Map nadal ma 6 wierszy ryzyk, a *Risk Response Guidance* dokładnie 6 wierszy
- Oceny Impact/Likelihood nietknięte: liczba wystąpień `| High | High |` = 2 (ryzyka #1 i #5)
- Anty-wzorzec fake-drift obecny w trzech wierszach
- Kolumna dowodu wiersza #2 niesie oba człony: grep na `tor żądania` oraz na `RLS` trafia
  w linii wiersza #2
- Prettier nie zgłasza zmian: `npx prettier --check context/foundation/test-plan.md`

#### Weryfikacja ręczna

- Ryzyko #1 nadal czyta się jako scenariusz awarii w kategoriach użytkownika, nie jako nazwa testu,
  i nie zawiera kotwic plik:linia (§1 zasada #3)
- Kolumna *Source* ryzyka #1 nie została przepisana — cytat PRD jest dosłowny
- Granica CI/ręczne dla #2 jest czytelna dla kogoś, kto czyta tylko ten jeden wiersz, bez §3 i §5
- Kolumna dowodu #2 nie obiecuje już zapytania do bazy w CI, a mimo to nadal wyklucza odczyt
  SQL-a jako dowód (lekcja z `lessons.md` nierozmyta)
- Trzy kopie anty-wzorca fake-drift mówią to samo
- Kalibracja pod tabelą („Ryzyka #1 i #5 to jedyne High × High i idą pierwsze") nadal prawdziwa

**Uwaga implementacyjna**: zatrzymaj się po tej fazie na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Propagacja do §3, §5, §6.1 i §6.3

### Przegląd

Pięć miejsc opierających się o to, co poprawiły fazy 1 i 2. Wyłącznie usuwanie obalonych
twierdzeń — żadne z tych miejsc nie dostaje nowej treści merytorycznej ponad to, co ustaliły
poprzednie fazy.

### Wymagane zmiany

#### 1. §3 Faza 2 — kolumny *Goal* i *Test types*

**Plik**: `context/foundation/test-plan.md` (§3, linia 83)

**Cel**: kolumna *Test types* deklaruje `integration (real Postgres, two identities)` — warstwę,
której CI nie ma. Kolumna *Goal* mówi „sprawdzone wykonaniem, nie grepem", co po fazie 2 wymaga
doprecyzowania, czym jest to wykonanie.

**Kontrakt**: *Test types* ma odzwierciedlać dwuczłonową odpowiedź z §2 wiersza #2 — integracja na
poziomie żądania (dwie tożsamości, atrapa klienta) plus jawnie nazwany dym ręczny dla RLS.
*Goal* zachowuje swoją istotę („cudza drużyna niedostępna na czterech operacjach, bariera trasy
przepuszcza wyłącznie sesję, sprawdzone wykonaniem nie grepem") i dostaje granicę: co z tego
domyka bramka CI, a co zostaje lokalne. Kolumny `#`, *Phase name*, *Risks covered*, *Status*
i *Change folder* zostają nietknięte — Faza 2 nadal pokrywa #2 i #3, nadal jest `not started`
i nadal stoi na pozycji drugiej.

#### 2. §3 akapit „Uzasadnienie kolejności"

**Plik**: `context/foundation/test-plan.md` (§3, akapit rozpoczynający się „Uzasadnienie
kolejności:", linie 87–93)

**Cel**: akapit twierdzi, że Faza 1 „przy okazji rozstrzyga strukturalne pytanie o pogodzenie testu
wykonawczego z regułą czystości testów — czym odblokowuje Fazę 2". Rozstrzygnięcie zapadło
**przed** Fazą 1, w jej badaniu, i zostało utrwalone w `AGENTS.md`.

**Kontrakt**: wniosek zostaje — Faza 2 jest odblokowana, kolejność faz się nie zmienia. Upada
tylko przyczyna. Nowe brzmienie ma powiedzieć, że pytanie zostało rozstrzygnięte w badaniu Fazy 1
(a nie w jej implementacji) i że Faza 2 wchodzi już na rozstrzygniętym gruncie. Uzasadnienie
pozycji Fazy 1 stoi na własnych nogach bez tego członu: domyka jedno z dwóch High × High najtańszą
warstwą, jaka może je udowodnić. Pozostałe zdania akapitu (Faza 2, Faza 3, Faza 4) zostają
dosłownie.

#### 3. §5 bramka „integration na izolacji i przepuszczaniu"

**Plik**: `context/foundation/test-plan.md` (§5, wiersz `integration na izolacji i przepuszczaniu`)

**Cel**: bramka mówi dziś `required after §3 Phase 2` i w kolumnie *Catches* obiecuje łapanie
„ujawnienia cudzej drużyny". Po fazie 2 wiadomo, że bramka automatyczna łapie zawężenie zapytania
przez trasę, a nie regresję samej polityki RLS.

**Kontrakt**: bramka **zostaje wymagana** po Fazie 2 — decyzja użytkownika była „tor żądania w CI,
RLS ręcznie", a nie zejście bramki do `recommended`. Kolumna *Catches* ma nazwać dokładnie to, co
bramka faktycznie łapie: przepuszczenie żądania bez sesji oraz wypuszczenie wiersza cudzego konta
przez trasę.

Dym RLS dostaje **własny, jedenasty wiersz**, a nie dopisek do istniejącego „dym ręczny przeciwko
produkcji". Ten istniejący wiersz jest `recommended after §3 Phase 4` i biegnie „między scaleniem
a produkcją" — dym RLS jest natomiast **lokalny** (`npx supabase start`) i potrzebny **po Fazie 2**.
Złożenie ich w jeden wiersz wpisałoby do przewodnika, że jedyna kontrola samych polityk RLS jest
zalecana dwie fazy za późno i przeciwko innemu środowisku, niż ustala §2. Nowy wiersz:

- *Gate*: `dym ręczny na politykach RLS (lokalny stos)`
- *Where*: `local (npx supabase start)`
- *Required?*: `recommended after §3 Phase 2`
- *Catches*: regresja polityki RLS niewidzialna dla CI — bramka integracyjna idzie na atrapie
  klienta, więc rozbrojenie polityki w migracji przejdzie w niej na zielono

Wstaw go bezpośrednio pod wierszem `integration na izolacji i przepuszczaniu`, żeby para
automat + dym stała obok siebie — dokładnie tak, jak stoi już para dla ryzyka #4 (`e2e na ścieżce
persony głównej` i `dym ręczny przeciwko produkcji`). Istniejącego wiersza dymu produkcyjnego
**nie ruszaj**; jego zakres (tor potwierdzania adresu) zostaje dosłownie.

#### 4. §6.1 — punkt „Czystość" w wypełnionej książce kucharskiej

**Plik**: `context/foundation/test-plan.md` (§6.1, linia 153)

**Cel**: **najważniejsza korekta całego refreshu.** §6.1 nie jest placeholderem — to wypełniona
instrukcja, którą czyta ktoś dodający dziś test. Niesie starą literę **i** nakazuje działanie
wedle niej: „Jeśli import jest potrzebny, wydziel czysty rdzeń". Reguła tego nie wymusza, a
badanie (research §7, opcja c) nazywa ten ruch przesuwaniem dziury o piętro: glue trasy zostaje
niepokryty i nic nie wiąże faktu, że cienka trasa woła rdzeń.

**Kontrakt**: punkt „Czystość" ma odsyłać do kryterium runtime z §4 zamiast powtarzać starą literę,
i przestać zalecać wydzielanie czystego rdzenia jako domyślną odpowiedź na potrzebę importu.
Zamiast tego: dla czystego modułu w `src/lib/` nic się nie zmienia (rdzeń i tak jest czysty);
gdy moduł pod testem sięga po `@/lib/supabase`, drogą zgodną z regułą jest podmiana tego modułu
w teście, a wydzielenie rdzenia pozostaje **dopuszczalnym wyborem pokrycia, nie wymogiem zgodności**.
Pozostałe cztery punkty §6.1 (lokalizacja, nazewnictwo, test referencyjny `evaluate-team.test.ts`,
uruchomienie `npm test`) zostają dosłownie — §6.1 opisuje test jednostkowy czystego modułu i ta
recepta jest nadal poprawna.

#### 5. §6.3 placeholder

**Plik**: `context/foundation/test-plan.md` (§6.3, linia 165)

**Cel**: placeholder niesie „wykonywany przeciwko prawdziwemu Postgresowi, nie grepowany po SQL-u"
— połowa tego zdania została obalona.

**Kontrakt**: wpis **pozostaje placeholderem** w formacie `TBD — see §3 Phase 2` i nie dostaje
treści książki kucharskiej; wypełni go Faza 2, gdy zostanie dowieziona. Zmienia się wyłącznie
nawias opisujący, czego wzorzec będzie dotyczył: człon „przeciwko prawdziwemu Postgresowi" znika,
człon „nie grepowany po SQL-u" **zostaje** — ta połowa jest nadal prawdziwa i jest sednem lekcji
z `lessons.md`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Zero trafień na trzy frazy w całym pliku: `prawdziwemu Postgresowi`, `prawdziwego Postgresa`,
  `real Postgres`
- Stara litera zniknęła z §6.1 — grep na `może importować` zwraca pusto w całym pliku
- §6.3 nadal jest placeholderem: liczba linii pasujących do `^- TBD — see §3 Phase` = 5
  (bez kotwicy `^- ` licznik wynosi 6 — szóste trafienie to akapit wprowadzający §6)
- §3 tabela nadal ma 4 wiersze faz, statusy niezmienione (`researched` dla Fazy 1,
  `not started` dla 2–4)
- §5 ma 11 wierszy bramek (10 dotychczasowych + dym RLS na lokalnym stosie)
- Prettier nie zgłasza zmian: `npx prettier --check context/foundation/test-plan.md`

#### Weryfikacja ręczna

- §6.1 czytany przez kogoś, kto ma dziś dopisać test, prowadzi do drogi zgodnej z `AGENTS.md:11`
  i nie zaleca wydzielania rdzenia jako domyślnej odpowiedzi
- §3 akapit uzasadnienia nadal broni tej samej kolejności faz i zmienił przyczynę, nie wniosek
- §5 bramka „integration na izolacji" nadal jest `required after §3 Phase 2`
- Dym RLS ma w §5 własny wiersz, nazywający lokalny stos i `recommended after §3 Phase 2`,
  postawiony bezpośrednio pod bramką integracyjną
- Wiersz „dym ręczny przeciwko produkcji" jest nietknięty — nadal wyłącznie o torze
  potwierdzania adresu

**Uwaga implementacyjna**: zatrzymaj się po tej fazie na ręczne potwierdzenie przed Fazą 4.

---

## Faza 4: §8 stempel, kontrola spójności, odblokowanie Fazy 1 wdrożenia

### Przegląd

Zamknięcie refreshu: datowanie, kontrola że nic obalonego nie przetrwało, i potwierdzenie, że
sekwencyjna blokada z `change.md` może zostać zdjęta.

### Wymagane zmiany

#### 1. §8 Freshness Ledger i nagłówek „Last updated"

**Plik**: `context/foundation/test-plan.md` (linia „Last updated” w bloku cytatu na początku
dokumentu; trzy punkty ledgera pod nagłówkiem `## 8. Freshness Ledger`)

**Uwaga o kotwicach**: nie kotwicz tej edycji na numerach linii — wcześniejsze fazy przesuwają
numerację, a zakres 197–199 wypada w §7, dla której kryterium 4.5 wymaga zerowego dyffu.

**Cel**: bez adnotacji refresh jest w dokumencie niewidoczny — daty w §8 już brzmią `2026-09-07`,
więc sama ich aktualizacja nie zostawia śladu.

**Kontrakt**: trzy linie ledgera dostają datę `2026-09-07`, a §8 dostaje **jedną** linię nazywającą
ostatni refresh: datę, wyzwalacz (przepisanie reguły czystości testów w `AGENTS.md`, commit
`62a6f68`) i dotknięte sekcje (§2, §3, §4, §5, §6.1, §6.3). Trzymamy **tylko ostatni wpis** —
przy kolejnym refreshu ta linia zostaje nadpisana, nie dopisana. Lista czterech warunków refreshu
poniżej zostaje bez zmian. Nagłówek dokumentu „Last updated" na `2026-09-07`.

#### 2. `change.md` tej zmiany

**Plik**: `context/changes/2026-09-07-test-plan-refresh/change.md`

**Cel**: oznaczyć zmianę jako zaplanowaną.

**Kontrakt**: `status: planned`, `updated: 2026-09-07`. Reszta frontmattera i cała sekcja `## Notes`
bez zmian.

#### 3. Kontrola spójności całego pliku

**Plik**: `context/foundation/test-plan.md` (odczyt, bez edycji)

**Cel**: refresh dotknął sześciu sekcji; kontrola ma wykazać, że żadne obalone twierdzenie nie
przetrwało w miejscu, którego nie przewidziano, i że nic poza zakresem nie zostało ruszone.

**Kontrakt**: kontrola ma dwa kierunki. **Negatywny** — grepy z kryteriów poniżej nie znajdują
obalonych fraz. **Pozytywny** — dyff całego pliku wobec stanu sprzed refreshu nie dotyka: listy
sześciu ryzyk §2 (poza brzmieniem #1 i komórkami *Response*), §1 Strategy, §7 przestrzeni
negatywnej, kolejności i statusów faz §3, cytatów hot-spotów, ani placeholderów §6.2 i §6.4–§6.6.

#### 4. Zdjęcie blokady sekwencyjnej z Fazy 1 wdrożenia

**Plik**: brak edycji — weryfikacja stanu

**Cel**: `change.md` tego refreshu zapisuje decyzję użytkownika: Faza 1
(`context/changes/2026-09-07-testing-save-barrier/`, status `researched`) czeka na ten refresh,
a jej `/10x-plan` ma ruszyć przeciwko poprawionym §2 i §4.

**Kontrakt**: potwierdzić, że wszystkie cztery komórki, o które opierało się to oczekiwanie —
§2 wiersz #1 kolumna kontekstu, §2 wiersz #1 anty-wzorce, §4 wiersz integration, §4 ograniczenia
twarde — są po refreshu w stanie, który `/10x-plan` Fazy 1 może przeczytać bez natrafienia na
obalone twierdzenie. Nie zmieniaj statusu Fazy 1 w §3 (zostaje `researched`) ani jej `change.md`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- Zero trafień na pełny zestaw obalonych fraz w całym pliku: `prawdziwemu Postgresowi`,
  `real Postgres`, `Wymaga rozstrzygnięcia`, `bez łamania czystości testów`, `może importować`
- §8 niesie dokładnie jedną linię z `62a6f68`, a trzy punkty ledgera mają datę `2026-09-07`
  (licznik samych wystąpień `2026-09-07` jest bezużyteczny — plik miał ich 10 przed refreshem)
- §8 ma linię o ostatnim refreshu z odwołaniem do commita `62a6f68`
- Struktura nietknięta: liczba nagłówków `## ` = 8
- §7 bit-w-bit niezmieniona — wytnij sekcję z obu wersji i porównaj:
  `git show HEAD:context/foundation/test-plan.md | awk '/^## 7\./{f=1} /^## 8\./{f=0} f' > /tmp/s7-old`,
  to samo `awk` nad plikiem roboczym do `/tmp/s7-new`, następnie `diff /tmp/s7-old /tmp/s7-new` pusty
- §1 niezmieniona — ta sama procedura dla zakresu `/^## 1\./` … `/^## 2\./`, `diff` pusty
- `change.md` ma `status: planned`
- Prettier: `npx prettier --check context/foundation/test-plan.md`
- `git status --short` pokazuje wyłącznie `context/foundation/test-plan.md` i pliki folderu zmiany

#### Weryfikacja ręczna

- Pełny przebieg czytelniczy §2 → §3 → §4 → §5 → §6: żaden przeskok między sekcjami nie tworzy
  sprzeczności
- Sześć ryzyk §2 to nadal te same sześć scenariuszy, w tej samej kolejności, z tymi samymi ocenami
- `/10x-plan` Fazy 1 może ruszyć — cztery komórki, o które się opiera, są aktualne
- Fałszywa teza z `context/archive/2026-09-06-cross-account-team-isolation/plan.md:56-58` nie została
  ruszona (archiwum niezmienne), a przewodnik jej już nie powtarza

---

## Strategia testowania

Ten refresh nie produkuje kodu, więc „testem" jest kontrola dokumentu. Trzy poziomy:

### Kontrola negatywna (grep na obalone frazy)

Zestaw frazowy z kryteriów Fazy 4 uruchamiany po **każdej** fazie, nie tylko na końcu — obalone
twierdzenia żyją w dziewięciu miejscach i przeoczenie jednego jest głównym trybem awarii tej zmiany.

### Kontrola pozytywna (dyff wobec zakresu)

`git diff context/foundation/test-plan.md` czytany pod kątem tego, czego **nie** miało być:
§1, §7, listy ryzyk, kolejności faz, cytatów hot-spotów, placeholderów §6.2 i §6.4–§6.6.
Wszystko poza zamierzonymi komórkami jest regresją zakresu.

### Kontrola czytelnicza

Przewodnik jest czytany wyrywkowo — pojedynczy wiersz tabeli, pojedyncza podsekcja §6. Kontrola
ręczna każdej fazy sprawdza właśnie to: czy zmieniony fragment jest samowystarczalny, czy zakłada,
że czytelnik przeczytał inną sekcję.

### Kroki testowania ręcznego

1. Przeczytaj §2 wiersz #2 w całości, bez §3 i §5 — czy granica CI/ręczne jest z niego czytelna?
2. Przeczytaj §6.1 jak ktoś, kto ma dziś dopisać test do `src/lib/` — czy prowadzi do drogi
   zgodnej z `AGENTS.md:11`?
3. Przeczytaj §3 akapit uzasadnienia — czy broni tej samej kolejności co przed refreshem?
4. Porównaj §4 akapit ograniczeń twardych z `AGENTS.md:11` zdanie po zdaniu.
5. Sprawdź `git diff` między `## 7.` a `## 8.` — musi być pusty.

## Uwagi dotyczące migracji

Nie dotyczy — jeden plik dokumentacji, brak danych, brak schematu, brak konsumentów w kodzie.
`context/archive/` pozostaje nietknięte z twardej reguły `AGENTS.md`.

## Referencje

- Tożsamość zmiany: `context/changes/2026-09-07-test-plan-refresh/change.md`
- Badanie gruntujące wszystkie pięć korekt: `context/changes/2026-09-07-testing-save-barrier/research.md`
  (szczególnie §6 — powierzchnia ryzyka #1; §7 — opcje wykonania i niedostępność Postgresa w CI;
  *Open Questions* #1 — rozstrzygnięcie normatywne)
- Obowiązująca reguła czystości: `AGENTS.md:11`
- Ograniczenie CI: `.github/workflows/ci.yml:18-25`
- Zasada przekrojowa wiążąca anty-wzorzec fake-drift: `context/foundation/test-plan.md` §1
  oraz `context/foundation/lessons.md` §„Strażnik, który jest zielony na commicie bazowym"
- Przesłanka unieważniona, nietykalna: `context/archive/2026-09-06-cross-account-team-isolation/plan.md:56-58`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw kroków.

### Faza 1: §4 Stack — reguła czystości i wiersz integration

#### Automatyczne

- [x] 1.1 Stara litera zniknęła z §4 — grep na `może importować` bez trafień w §4 — d3f70c2
- [x] 1.2 Nowe kryterium runtime obecne w §4 — d3f70c2
- [x] 1.3 Grep na `Wymaga rozstrzygnięcia` zwraca pusto — d3f70c2
- [x] 1.4 `npx prettier --check context/foundation/test-plan.md` przechodzi (N/A — pada też na commicie bazowym; `--write` przeformatowałby cały plik i złamał 4.5/4.6. Zamiast tego zweryfikowano, że po znormalizowaniu prettierem obu stron dyff ogranicza się do zamierzonych edycji) — d3f70c2
- [x] 1.5 Tabela stosu §4 nadal ma 7 wierszy — d3f70c2

#### Ręczne

- [x] 1.6 Cztery elementy kontraktu reguły zgodne z `AGENTS.md:11`, żaden nie zwinięty — d3f70c2
- [x] 1.7 Cztery pozostałe ograniczenia twarde nietknięte — d3f70c2
- [x] 1.8 Wiersz integration nie przesądza wyboru opcji wykonania za Fazę 1 — d3f70c2

### Faza 2: §2 Risk Map — zawężenie #1, granica dla #2, anty-wzorce

#### Automatyczne

- [x] 2.1 Fraza o prawdziwym Postgresie zniknęła z §2 wiersza #2 — acf2a3e
- [x] 2.2 Grep na `bez łamania czystości testów` i `jak pogodzić test wykonawczy` zwraca pusto — acf2a3e
- [x] 2.3 Risk Map ma 6 wierszy ryzyk, Response Guidance 6 wierszy — acf2a3e
- [x] 2.4 Liczba wystąpień `| High | High |` = 2 — acf2a3e
- [x] 2.5 Anty-wzorzec fake-drift obecny w 3 wierszach — acf2a3e
- [x] 2.5b Kolumna dowodu wiersza #2 niesie oba człony (tor żądania + RLS) — acf2a3e
- [x] 2.6 `npx prettier --check` przechodzi (N/A — jak 1.4; zamiast tego `git diff -U0` potwierdza, że zmieniły się wyłącznie linie 47, 67, 68 i 72) — acf2a3e

#### Ręczne

- [x] 2.7 Ryzyko #1 nadal scenariuszem użytkownika, bez kotwic plik:linia — acf2a3e
- [x] 2.8 Kolumna *Source* ryzyka #1 nieprzepisana (cytat PRD dosłowny) — acf2a3e
- [x] 2.9 Granica CI/ręczne czytelna z samego wiersza #2 — acf2a3e
- [x] 2.9b Kolumna dowodu #2 nie obiecuje zapytania do bazy w CI, ale nadal wyklucza odczyt SQL-a — acf2a3e
- [x] 2.10 Trzy kopie anty-wzorca spójne treściowo — acf2a3e
- [x] 2.11 Kalibracja pod tabelą nadal prawdziwa — acf2a3e

### Faza 3: Propagacja do §3, §5, §6.1 i §6.3

#### Automatyczne

- [x] 3.1 Zero trafień na `prawdziwemu Postgresowi`, `prawdziwego Postgresa`, `real Postgres` — f83fed7
- [x] 3.2 Stara litera zniknęła z §6.1 — grep na `może importować` pusty w całym pliku — f83fed7
- [x] 3.3 Liczba linii pasujących do `^- TBD — see §3 Phase` = 5 — f83fed7
- [x] 3.4 §3 ma 4 wiersze faz, statusy niezmienione — f83fed7
- [x] 3.5 §5 ma 11 wierszy bramek (10 dotychczasowych + dym RLS) — f83fed7
- [x] 3.6 `npx prettier --check` przechodzi (N/A — jak 1.4; zamiast tego `git diff -U0` potwierdza pięć hunków dokładnie w §3, §5, §6.1 i §6.3) — f83fed7

#### Ręczne

- [x] 3.7 §6.1 prowadzi do drogi zgodnej z `AGENTS.md:11`, nie zaleca rdzenia domyślnie — f83fed7
- [x] 3.8 §3 uzasadnienie broni tej samej kolejności, zmieniona tylko przyczyna — f83fed7
- [x] 3.9 §5 bramka izolacji nadal `required after §3 Phase 2` — f83fed7
- [x] 3.10 Dym RLS ma w §5 własny wiersz (lokalny stos, `recommended after §3 Phase 2`) — f83fed7
- [x] 3.11 Wiersz dymu produkcyjnego nietknięty — f83fed7

### Faza 4: §8 stempel, kontrola spójności, odblokowanie Fazy 1 wdrożenia

#### Automatyczne

- [x] 4.1 Zero trafień na pełny zestaw obalonych fraz w całym pliku
- [x] 4.2 Dokładnie jedna linia z `62a6f68`; trzy punkty ledgera datowane `2026-09-07`
- [x] 4.3 §8 ma linię o ostatnim refreshu z commitem `62a6f68`
- [x] 4.4 Liczba nagłówków `## ` = 8
- [x] 4.5 `git diff` nie pokazuje żadnej linii między `## 7.` a `## 8.`
- [x] 4.6 `git diff` nie pokazuje żadnej linii między `## 1.` a `## 2.`
- [x] 4.7 `change.md` ma `status: planned` (zaadaptowane — kryterium opisywało wyjście z etapu planowania i `planned` obowiązywał przed wejściem w implementację; cykl życia `/10x-implement` zastępuje je przez `implementing` → `implemented`)
- [x] 4.8 `npx prettier --check` przechodzi (N/A — jak 1.4; zamiast tego dyff wobec 17d7aa3 daje 12 hunków wyłącznie w zamierzonych komórkach, a §1 i §7 są bit-w-bit)
- [x] 4.9 `git status --short` pokazuje wyłącznie test-plan.md i pliki folderu zmiany

#### Ręczne

- [x] 4.10 Przebieg czytelniczy §2 → §3 → §4 → §5 → §6 bez sprzeczności
- [x] 4.11 Sześć ryzyk §2 to te same sześć, w tej samej kolejności, z tymi samymi ocenami
- [x] 4.12 `/10x-plan` Fazy 1 może ruszyć — cztery komórki aktualne
- [x] 4.13 Archiwum nietknięte, a przewodnik nie powtarza jego fałszywej tezy
