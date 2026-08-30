---
project: "team-maker"
context_type: greenfield
created: 2026-08-30
updated: 2026-08-30
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 2
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kategoria bolu"
      decision: "brak jawnego bolu; produkt jest rozrywka / wycinkiem gry"
    - topic: "uklad person"
      decision: "recenzent kursu = persona glowna; gracz = persona drugorzedna"
    - topic: "wglad"
      decision: "brak wyroznika produktowego; celowo najtanszy nosnik czterech warunkow certyfikacji"
    - topic: "forma logowania"
      decision: "e-mail + haslo, samoobslugowa rejestracja"
    - topic: "potwierdzenie e-mail"
      decision: "nie wymagane; konto aktywne natychmiast"
    - topic: "model rol"
      decision: "plaski; jedna rola gracz, izolacja wlasnych zasobow"
    - topic: "niezalogowany na chronionej trasie"
      decision: "przekierowanie na ekran logowania; brak strony powitalnej"
    - topic: "budzet czasowy MVP"
      decision: "1-2 tygodnie pracy po godzinach; mvp_weeks: 2"
    - topic: "kryterium drugorzedne"
      decision: "widoczny licznik brakujacych punktow kompetencji"
    - topic: "unikalnosc postaci w druzynie"
      decision: "ta sama postac nie moze wystapic dwa razy w jednej druzynie"
    - topic: "rozmiar puli postaci"
      decision: "10-12 postaci"
    - topic: "zrodlo postaci"
      decision: "globalna, stala pula wspolna dla wszystkich graczy; gracz jej nie edytuje"
    - topic: "minimalny sklad druzyny"
      decision: "brak minimum; 6 to maksimum, liczy sie wylacznie prog kompetencji"
    - topic: "usuwanie druzyny"
      decision: "wymaga prostego okna potwierdzenia"
    - topic: "regula domenowa"
      decision: "walidacja pokrycia: aplikacja rozstrzyga, czy sklad pokrywa 7 kompetencji na poziomie >= 2 pkt"
    - topic: "zakres obliczen"
      decision: "sumy punktow oraz brakujace punkty na kompetencje; sugestia domykajaca odrzucona"
    - topic: "rozwiazywalnosc puli"
      decision: "wiazacy warunek danych poczatkowych: zawsze istnieje co najmniej jedno rozwiazanie"
    - topic: "sugestia domykajaca"
      decision: "odrzucona po rundzie sokratejskiej; przeniesiona do Non-Goals jako solver poza zakresem MVP"
    - topic: "typ produktu"
      decision: "aplikacja webowa"
    - topic: "skala"
      decision: "garstka uzytkownikow; regula domenowa niewrazliwa na skale"
    - topic: "termin i tryb pracy"
      decision: "brak twardego terminu; praca po godzinach"
    - topic: "niespojnosc FR-017 / FR-018"
      decision: "oslabiono FR-018: komunikat ogolny zamiast wyliczania luk; FR-017 pozostaje milym dodatkiem"
  frs_drafted: 19
  quality_check_status: accepted
---

# Shape notes

## Initial idea (verbatim, as supplied)

> Prosta aplikacja jedno-stronnicowa będąca jednym z widoków grze w stylu cyberpunk. Na różnych widokach pokazuje ona: listę skompletowanych drużyn, którymi gracz będzie wypełniał misje; główny widok kompletowania drużyny z listą maksymalnie sześciu członków, wykresem pajęczynowym pokazującym siedem kompetencji, które mają znaczenie w rozgrywce ("Przygotowanie bojowe", "Netrunning", "Medycyna", "Negocjacje", "Inżynieria", "Infiltracja", "Rozpoznanie"). Każdy aspekt ma od 0 do 5 punktów.; Widok wyboru i uszczegółowienia członka drużyny (popup), gdzie jest lista dostępnych postaci (lewa wąska kolumna), a po jej wyborze w głównej, prawej kolumnie pojawiają się szczegóły i możliwość wyboru perków postaci. Mechanika komponowania kompetencji drużyny to łatwa łamigłówka, która polega na tym, że każda dostępna postać ma specjalizację dającą 2 punkty kompetencji oraz trzy perki, z czego każdy uzupełnia 1 punkt jednej kompetencji, a można wybrać maksymalnie dwa perki u jednego członka drużyny. Celem gracza jest zebranie takiej drużyny, która ma minimum 2 punkty w każdej kompetencji. Członków jest maksymalnie 6, a kompetencji jest 7, więc zawsze jest potrzeba uzupełnienia kompetencji perkami. W momencie osiągnięcia 2 punktów w każdej kompetencji, zostaje odblokowany przycisk "Wyrusz na zlecenie". Kliknięcie w ten przycisk służy jednocześnie do zapisania składu drużyny wraz z ustawionymi perkami u jej członków. Druga jego funkcja jest granicą tego projektu i pokazuje "Work in Progress" zamiast rozpocząć rozgrywkę, która nie jest częścią teg projektu. Każda drużyna to rekord w bazie danych z narzunocą nazwą, która może być w postaci hashu, co pasuje do cyberpunka. Aby skorzystać z aplikacji użytkownik/gracz musi mieć zarejestrowane konto i być zalogowanym. Po zalogowaniu pokazuje my się lista jego drużyn lub przycisk do tworzenia nowej drużyny, jezeli dopiero założył konto.
> Drużyny są przypisane do gracza i nie są widoczne cross-user. W projekt nie wchdzą żadne dodatki typu: edycja danych członków (poza wyborem perków); edycja nazwy drużyny.
> Zarządzanie drużyną to pełny CRUD, czyli można zapisać drużynę, wyświetlić ją, zaktualizować i usunąć.
> Od samego początku zakładam użycie 10xAstroStarter, Supabase i Cloudflare.
> Celem całego projektu jest realizacja poniższych warunków:
> - Obsługa akcji CRUD: tworzenie, odczytywanie, aktualizacja i usuwanie elementów.
> - Logika biznesowa: przynajmniej jedna funkcja realizująca logikę.
> - Testy: co najmniej jeden zestaw testów adresujący konkretne ryzyko zdefiniowane w dokumencie test-plan.
> - Autentykacja: dostęp powiązany z użytkownikiem, który loguje się i widzi przypisane do niego zasoby.
>
> Celem nie jest super rozbudowana wszystko-mająca aplikacja, tylko proste MVP. Każda decyzja powinna iść w kierunku uproszczenia, a nie skomplikowania projektu.

## Vision & Problem Statement

Nie ma tu klasycznego bólu użytkownika. Aplikacja jest pojedynczym wycinkiem gry
w stylu cyberpunk — ekranem kompletowania drużyny — wyjętym z gry, która nie
powstaje. Osobą, która po nią sięga, jest recenzent kursu / rekruter: wchodzi bez
kontekstu fabularnego, zakłada konto i w kilka minut musi zobaczyć, że produkt
tworzy, odczytuje, aktualizuje i usuwa własne rekordy użytkownika oraz stosuje
nietrywialną regułę domenową. Dziś taki dowód kompetencji przyjmuje najczęściej
formę listy to-do, w której reguła domenowa jest doklejona i słabo widoczna.

Wgląd, zapisany dosłownie za użytkownikiem, jest antymarketingowy: nie ma tu
wyróżnika produktowego. Ten projekt został wybrany świadomie jako najtańszy nośnik
czterech warunków certyfikacji (CRUD, logika biznesowa, testy, uwierzytelnianie),
a nie dlatego, że rozwiązuje niezaspokojoną potrzebę rynkową. Każda decyzja
zakresowa ma iść w stronę uproszczenia, nie rozbudowy.

> Sokrates: rozważono kontrargument — "to jest solver łatwej układanki pokryciowej,
> gracz rozwiąże ją na kartce w dwie minuty". Rozstrzygnięcie: przyjęte bez
> obrony. Wartością nie jest rozwiązanie układanki, tylko widoczna reguła domenowa
> plus trwały zapis składu.

## User & Persona

**Persona główna — recenzent kursu / rekruter.** Ocenia projekt zaliczeniowy.
Sięga po aplikację raz, bez wcześniejszej znajomości świata gry ani zasad
mechaniki. Moment kontaktu: otwiera link, rejestruje konto, loguje się i ma w ciągu
kilku minut potwierdzić cztery warunki (CRUD, logika biznesowa, testy,
uwierzytelnianie powiązane z zasobami użytkownika). Optymalizujemy pod czytelność
dla obcego: widoczny CRUD, widoczna reguła domenowa, zero tutoriala.

### Secondary persona

**Gracz gry w stylu cyberpunk.** Fikcja ramująca. Kompletuje drużynę przed
wyruszeniem na zlecenie. Jego doświadczenie nadaje ekranowi sens narracyjny, ale
nie wiąże decyzji zakresowych — jeśli decyzja poprawia frajdę gracza, a zwiększa
złożoność, wygrywa uproszczenie.

## Success Criteria

### Primary

- Osoba bez wcześniejszej znajomości mechaniki przechodzi od rejestracji do zapisanej
  drużyny spełniającej próg (≥ 2 punkty w każdej z 7 kompetencji) bez tutoriala i bez
  pomocy z zewnątrz.
- Wszystkie cztery operacje CRUD na drużynie są wykonalne z interfejsu: zapis nowej
  drużyny, wyświetlenie listy i szczegółów, zmiana składu zapisanej drużyny, usunięcie
  drużyny.

### Secondary

- Widoczny licznik brakujących punktów: obok wykresu pajęczynowego lista kompetencji
  poniżej progu wraz z liczbą brakujących punktów. Prowadzi obcego przez łamigłówkę bez
  tutoriala, ale sam w sobie nie dowodzi, że produkt działa.

### Guardrails

- **Izolacja danych między kontami.** Gracz nie może zobaczyć ani zmienić cudzej drużyny —
  także przez odgadnięty identyfikator w adresie.
- **Zapisana drużyna zawsze spełnia próg.** Nie da się utrwalić składu, który nie ma
  2 punktów w każdej z 7 kompetencji; reguła obowiązuje także poza interfejsem.
- **Wykres zawsze zgodny ze składem.** Punkty pokazane na wykresie pajęczynowym odpowiadają
  faktycznym specjalizacjom i wybranym perkom.
- **Limity składu nie do obejścia.** Maksymalnie 6 członków, maksymalnie 2 perki na członka,
  ta sama postać nie może wystąpić dwa razy w jednej drużynie.

Budżet czasowy: 1–2 tygodnie pracy po godzinach (`mvp_weeks: 2`), bez twardego terminu.
Nie jest wymagane potwierdzenie kosztu stałego wysiłku — zakres mieści się w oknie trzech
tygodni.

## User Stories

### US-01: Gracz kompletuje i zapisuje pierwszą drużynę

- **Given** zalogowany gracz bez żadnej zapisanej drużyny
- **When** rozpoczyna kompletowanie nowej drużyny, dobiera postacie i ich perki tak, że każda
  z siedmiu kompetencji osiąga co najmniej 2 punkty, i używa przycisku "Wyrusz na zlecenie"
- **Then** drużyna zostaje zapisana pod automatycznie wygenerowaną nazwą-hashem, gracz widzi
  potwierdzenie zapisu oraz komunikat "Work in Progress"

#### Acceptance Criteria
- Wykres pajęczynowy odzwierciedla sumę punktów ze specjalizacji i wybranych perków po każdej zmianie
- Przycisk "Wyrusz na zlecenie" jest zablokowany, dopóki którakolwiek kompetencja ma mniej niż 2 punkty
- Zablokowany przycisk pokazuje komunikat ogólny o niespełnionym progu; wyliczenie brakujących punktów nie jest wymagane
- Nie da się dodać siódmego członka ani trzeciego perka u jednej postaci
- Nie da się dodać tej samej postaci dwukrotnie
- Pusta lista drużyn pokazuje wyjaśnienie i wezwanie do utworzenia pierwszej drużyny, a nie zero wyników

### US-02: Gracz zmienia skład zapisanej drużyny

- **Given** zalogowany gracz z co najmniej jedną zapisaną drużyną
- **When** otwiera drużynę, wymienia członka lub zmienia jego perki i zapisuje zmiany
- **Then** zapisany skład odzwierciedla zmianę, a nazwa-hash drużyny pozostaje niezmieniona

#### Acceptance Criteria
- Zapis zmian jest możliwy wyłącznie wtedy, gdy skład nadal spełnia próg 2 punktów w każdej kompetencji
- Usunięcie członka, które cofa próg, ponownie blokuje możliwość zapisu
- Nazwa drużyny nie jest edytowalna z żadnego miejsca interfejsu

### US-03: Gracz usuwa drużynę

- **Given** zalogowany gracz z co najmniej jedną zapisaną drużyną
- **When** wybiera usunięcie drużyny i potwierdza operację w oknie dialogowym
- **Then** drużyna znika z listy i nie da się jej odzyskać

#### Acceptance Criteria
- Rezygnacja z potwierdzenia pozostawia drużynę nietkniętą
- Usunięcie ostatniej drużyny przywraca stan pusty z wezwaniem do utworzenia nowej

### US-04: Drużyny są niewidoczne między kontami

- **Given** dwa różne konta, każde z własną zapisaną drużyną
- **When** gracz zalogowany na pierwszym koncie próbuje otworzyć, zmienić lub usunąć drużynę
  należącą do drugiego konta — także przez bezpośredni adres z jej identyfikatorem
- **Then** operacja jest odrzucona, a dane drugiego konta nie zostają ujawnione ani zmienione

#### Acceptance Criteria
- Lista drużyn nigdy nie zawiera drużyny innego konta
- Odgadnięty identyfikator w adresie nie daje dostępu do odczytu ani zapisu

## Functional Requirements

### Uwierzytelnianie i dostęp

- FR-001: Gość może założyć konto podając adres e-mail i hasło. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "otwarta rejestracja bez weryfikacji adresu zaprasza
  > konta śmieciowe". Rozstrzygnięcie: zachowano; MVP nie przechowuje danych wrażliwych,
  > a weryfikacja e-mail dokłada zależność od dostarczalności poczty.
- FR-002: Zarejestrowany gracz może zalogować się adresem e-mail i hasłem. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "brak resetu hasła — gracz, który zapomni hasła,
  > nie ma ścieżki powrotu". Rozstrzygnięcie: zachowano bez zmian; reset hasła trafia do
  > Non-Goals jako świadomie przyjęte ryzyko.
- FR-003: Zalogowany gracz może się wylogować. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "wylogowanie jest zbędne przy jednej sesji".
  > Rozstrzygnięcie: zachowano jako musi być — bez przełączania kont nie da się
  > zademonstrować, że drużyny nie są widoczne cross-user.
- FR-004: Niezalogowany odwiedzający jest przekierowywany na ekran logowania z każdej trasy aplikacji. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "przekierowanie to tylko warstwa interfejsu — samo
  > w sobie niczego nie chroni". Rozstrzygnięcie: zachowano; rzeczywista bariera musi być
  > egzekwowana na poziomie dostępu do danych, co jest zapisane w Guardrails.

### Zarządzanie drużynami (CRUD)

- FR-005: Gracz może zobaczyć listę wyłącznie własnych zapisanych drużyn. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "nowe konto widzi pustą listę — martwy ekran".
  > Rozstrzygnięcie: zachowano; stan pusty musi zawierać wyjaśnienie i wezwanie do
  > utworzenia pierwszej drużyny, a nie zero wyników.
- FR-006: Gracz może rozpocząć kompletowanie nowej drużyny. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "brak limitu liczby drużyn na konto".
  > Rozstrzygnięcie: zachowano bez limitu; limit to reguła i komunikat błędu bez wartości
  > przy tej skali.
- FR-007: Gracz może zapisać skompletowaną drużynę wraz ze składem i wybranymi perkami. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "zapis możliwy dopiero po spełnieniu progu — przerwana
  > praca w toku przepada". Rozstrzygnięcie: zachowano; wersje robocze trafiają do Non-Goals,
  > bo łamałyby Guardrail "zapisana drużyna zawsze spełnia próg".
- FR-008: Gracz może otworzyć zapisaną drużynę i zobaczyć jej skład, perki oraz wykres kompetencji. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "widok szczegółów duplikuje widok kompletowania".
  > Rozstrzygnięcie: zachowano jako jeden widok obsługujący oba przypadki — taniej i spójniej
  > niż osobny ekran tylko do odczytu.
- FR-009: Gracz może zmienić skład i perki zapisanej drużyny oraz zapisać zmiany. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "edycja może utrwalić drużynę poniżej progu".
  > Rozstrzygnięcie: zachowano; zapis zmian podlega dokładnie temu samemu progowi co
  > utworzenie nowej drużyny.
- FR-010: Gracz może usunąć własną drużynę po potwierdzeniu w oknie dialogowym. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "usunięcie jest nieodwracalne — brak kosza i
  > przywracania". Rozstrzygnięcie: zachowano; okno potwierdzenia jest jedyną ochroną,
  > kosz trafia do Non-Goals.
- FR-011: Gracz otrzymuje automatycznie wygenerowaną nazwę drużyny w postaci hashu i nie może jej edytować. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "hashe są nieodróżnialne — lista kilku drużyn to
  > lista losowych ciągów". Rozstrzygnięcie: zachowano; klimat ważniejszy niż rozpoznawalność
  > przy spodziewanej liczbie drużyn na konto.

### Kompletowanie drużyny

- FR-012: Gracz może dodać do drużyny maksymalnie sześciu członków, przy czym ta sama postać nie może wystąpić dwukrotnie. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "zakaz powtórzeń może uczynić łamigłówkę
  > nierozwiązywalną". Rozstrzygnięcie: zachowano; rozwiązywalność staje się wiążącym
  > warunkiem doboru danych początkowych — zapisane w Business Logic.
- FR-013: Gracz może otworzyć okno wyboru członka z listą dostępnych postaci w lewej kolumnie i szczegółami wybranej postaci w prawej. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "układ dwukolumnowy jest nieużywalny na wąskim
  > ekranie". Rozstrzygnięcie: zachowano; obsługa urządzeń mobilnych trafia do Non-Goals.
- FR-014: Gracz może wybrać maksymalnie dwa z trzech perków każdej postaci w drużynie. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "limit 2 z 3 jest arbitralny i gracz nie zrozumie
  > powodu". Rozstrzygnięcie: zachowano; to jest źródło trudności łamigłówki, a interfejs
  > ma nazywać limit wprost, nie tylko go egzekwować.
- FR-015: Gracz może usunąć członka z kompletowanej drużyny. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "usunięcie członka może cofnąć spełniony próg".
  > Rozstrzygnięcie: zachowano; blokada przycisku "Wyrusz na zlecenie" działa dwukierunkowo
  > — zamyka się z powrotem, gdy próg przestaje być spełniony.
- FR-016: Gracz widzi wykres pajęczynowy siedmiu kompetencji aktualizowany na bieżąco po każdej zmianie składu lub perków. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "wykres pajęczynowy to najdroższy element interfejsu
  > w całym MVP". Rozstrzygnięcie: zachowano; to jedyny element, który czyni regułę domenową
  > widoczną, więc koszt jest uzasadniony.
- FR-017: Gracz widzi listę kompetencji poniżej progu wraz z liczbą brakujących punktów. Priorytet: miły dodatek
  > Sokrates: Rozważono kontrargument: "licznik czyni łamigłówkę zbyt łatwą — gracz przestaje
  > myśleć, tylko domyka liczby". Rozstrzygnięcie: zachowano jako miły dodatek; personą główną
  > jest recenzent, więc czytelność jest ważniejsza niż wyzwanie.
- FR-018: Gracz może użyć przycisku "Wyrusz na zlecenie" dopiero wtedy, gdy każda z siedmiu kompetencji drużyny ma co najmniej 2 punkty. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "zablokowany przycisk bez wyjaśnienia frustruje —
  > gracz widzi szary przycisk i nie wie, czego brakuje". Rozstrzygnięcie: zachowano
  > w osłabionej formie — zablokowany przycisk pokazuje komunikat ogólny ("uzupełnij
  > kompetencje"), bez wyliczania konkretnych luk. Wyliczanie luk pozostaje w FR-017
  > o priorytecie "miły dodatek", więc FR-018 nie zależy od FR-017.
- FR-019: Gracz po użyciu przycisku "Wyrusz na zlecenie" widzi potwierdzenie zapisania drużyny oraz komunikat "Work in Progress" zamiast rozpoczęcia rozgrywki. Priorytet: musi być
  > Sokrates: Rozważono kontrargument: "jeden przycisk robi dwie rzeczy — zapisuje i prowadzi
  > w ślepą uliczkę; recenzent może nie zauważyć, że drużyna została zapisana".
  > Rozstrzygnięcie: FR zmieniony — komunikat musi wprost potwierdzać zapis, zanim pokaże
  > "Work in Progress".

## Non-Functional Requirements

- Zmiana składu lub perka jest odzwierciedlona na wykresie kompetencji i w stanie przycisku
  "Wyrusz na zlecenie" w czasie nieodczuwalnym dla użytkownika — poniżej 200 ms od wyboru.
- Żadna ścieżka dostępu nie ujawnia ani nie pozwala zmienić drużyny nienależącej do zalogowanego
  konta. Właściwość binarna: liczba drużyn cudzego konta widocznych lub modyfikowalnych wynosi zero.
- Hasła użytkowników nie są możliwe do odtworzenia z magazynu danych, nawet przy pełnym dostępie
  do jego zawartości. Właściwość binarna.
- Produkt pozostaje używalny na najnowszych wersjach głównych przeglądarek desktopowych.
  Gwarancja dla urządzeń mobilnych nie obowiązuje (patrz Non-Goals).

## Business Logic

Aplikacja rozstrzyga, czy wybrany skład pokrywa wszystkie siedem kompetencji na poziomie co
najmniej dwóch punktów, i tylko taki skład pozwala utrwalić.

Wejściem reguły jest to, co gracz wybrał: od zera do sześciu różnych postaci oraz od zera do
dwóch perków przy każdej z nich. Każda postać wnosi 2 punkty do jednej kompetencji ze swojej
specjalizacji; każdy wybrany perk wnosi 1 punkt do jednej kompetencji. Wyjściem jest siedem sum
punktowych (po jednej na kompetencję), liczba punktów brakujących do progu w każdej kompetencji
oraz binarny werdykt, czy skład jest dopuszczalny.

Gracz napotyka regułę bez czytania jej opisu: wykres pajęczynowy pokazuje siedem sum na bieżąco,
lista brakujących punktów nazywa luki, a przycisk "Wyrusz na zlecenie" pozostaje zablokowany
dopóki werdykt jest negatywny. Utrwalenie drużyny jest skutkiem domknięcia reguły, a nie osobną
decyzją gracza.

Reguła jest nietrywialna z powodu liczb: sześć postaci wnosi co najwyżej sześć specjalizacji przy
siedmiu kompetencjach, więc same specjalizacje nigdy nie wystarczają — perki muszą zostać użyte
w każdym poprawnym rozwiązaniu.

**Warunek poprawności puli postaci (wiążący):** pula 10–12 postaci musi być dobrana tak, by
przy ograniczeniach "maksimum sześciu członków", "brak powtórzeń postaci" i "maksimum dwa perki
na członka" istniało co najmniej jedno rozwiązanie domykające próg. Jest to warunek danych
początkowych, nie kodu, i podlega weryfikacji testem.

## Access Control

Model wieloużytkownikowy, płaski — jedna rola: **gracz**. Brak administratora, brak
współdzielenia, brak zaproszeń.

- **Rejestracja**: samoobsługowa, e-mail + hasło. Konto jest aktywne natychmiast po
  rejestracji — potwierdzenie adresu e-mail nie jest wymagane.
- **Logowanie**: e-mail + hasło.
- **Izolacja zasobów**: zalogowany gracz widzi, tworzy, aktualizuje i usuwa
  wyłącznie własne drużyny. Drużyny innych graczy są niewidoczne i niedostępne —
  także przez odgadnięty identyfikator.
- **Niezalogowany na dowolnej trasie aplikacji**: przekierowanie na ekran logowania.
  Nie ma publicznej strony powitalnej ani trybu gościa.
- **Macierz uprawnień**: gracz → pełny CRUD na własnych drużynach; gracz → brak
  jakiegokolwiek dostępu do cudzych drużyn. Nie ma innych ról ani zdolności.

> Sokrates: rozważono kontrargument — "tryb gościa/demo skróciłby recenzentowi drogę
> do zobaczenia mechaniki". Rozstrzygnięcie: odrzucone. Warunek certyfikacji wymaga
> dostępu powiązanego z zalogowanym użytkownikiem; tryb gościa dokłada drugą ścieżkę
> stanu bez punktów.

## Non-Goals

### Funkcjonalne

- **Rozgrywka i wykonywanie zleceń** — przycisk "Wyrusz na zlecenie" kończy się komunikatem
  "Work in Progress". Misje, walka i wyniki są jawną granicą projektu.
- **Edycja nazwy drużyny** — nazwa-hash jest nadawana automatycznie i niezmienna.
- **Edycja danych postaci poza wyborem perków** — specjalizacje, opisy i zestawy perków są stałe.
- **Tworzenie własnych postaci przez gracza** — pula jest globalna i zamknięta.
- **Reset i odzyskiwanie hasła** — gracz, który zapomni hasła, zakłada nowe konto.
- **Wersje robocze niedomkniętych drużyn** — zapis istnieje wyłącznie dla składów spełniających próg.
- **Kosz i przywracanie usuniętych drużyn** — usunięcie jest nieodwracalne; chroni je wyłącznie
  okno potwierdzenia.
- **Współdzielenie drużyn, role i panel administratora** — model dostępu pozostaje płaski, bez
  widoczności cross-user w jakąkolwiek stronę.
- **Sugestia, która postać lub perk domyka brakującą kompetencję** — aplikacja rozstrzyga, czy
  skład jest dopuszczalny, ale nie podpowiada, jak go domknąć. Rozważone jako FR-020 i odrzucone:
  solver przeszukujący pulę to najdroższy element logiki w całym MVP, a wykres pajęczynowy wraz
  z listą brakujących punktów czynią regułę widoczną bez niego.

### Niefunkcjonalne

- **Obsługa urządzeń mobilnych** — układ dwukolumnowy w oknie wyboru członka zakłada szeroki ekran;
  brak gwarancji responsywności.
- **Tryb offline** — aplikacja wymaga połączenia; brak lokalnej kopii drużyn i synchronizacji.
- **Zgodność z WCAG-AA** — bez audytu dostępności i bez gwarancji obsługi czytników ekranu;
  wykres pajęczynowy jest tu najsłabszym punktem.
- **Wielojęzyczność** — jeden język interfejsu, brak warstwy tłumaczeń.

## Open Questions

Brak. Kontrola jakości w Kroku 7 nie wykazała luk, a jedyna wykryta niespójność
(FR-017 kontra FR-018) została rozstrzygnięta w trakcie sesji — patrz `## Quality cross-check`.

## Notatka o skali

Reguła domenowa jest niewrażliwa na skalę: walidacja pokrycia liczy najwyżej sześć postaci
i dwanaście perków, więc jej koszt nie zależy od liczby graczy. Stukrotny wzrost liczby użytkowników
dotknąłby infrastruktury, nie reguły. Jedyny element, który byłby wrażliwy na skalę — sugestia
domykająca przeszukująca pulę przy każdej zmianie składu — został wykluczony z zakresu
(patrz `## Non-Goals`).

## Quality cross-check

Kontrola przeprowadzona w Kroku 7. Wynik: **accepted** — brak luk.

| Pozycja | Status |
| --- | --- |
| Kontrola dostępu | obecny |
| Logika biznesowa (reguła jednozdaniowa) | obecny |
| Artefakty projektu | obecny |
| Potwierdzenie kosztu czasowego | obecny (`mvp_weeks: 2`, poniżej progu 3 tygodni) |
| Non-Goals | obecny |
| Zachowane zachowanie | n/a (greenfield) |

Wykryta i rozstrzygnięta niespójność wewnętrzna: rozstrzygnięcie FR-018 pierwotnie wymagało
nazwania powodu blokady, co zależało od FR-017 o priorytecie "miły dodatek". Osłabiono
rozstrzygnięcie FR-018 do komunikatu ogólnego; zależność została usunięta. Brak pozycji
do wyprowadzenia do `## Open Questions`.

## Forward: tech-stack

Zgłoszone dobrowolnie przez użytkownika (NIE część schematu PRD — do podjęcia przez krok wyboru stosu):

- 10xAstroStarter jako punkt startowy repozytorium.
- Supabase jako backend (baza danych + uwierzytelnianie).
- Cloudflare jako platforma wdrożenia.

## Forward: technical-roadmap

Zgłoszone dobrowolnie przez użytkownika lub wynikające z rozstrzygnięć — NIE część schematu PRD,
do podjęcia przez kolejne ogniwa łańcucha (wybór stosu, plan implementacji, plan testów):

- Warunek certyfikacyjny wymaga co najmniej jednego zestawu testów adresującego konkretne
  ryzyko zdefiniowane w dokumencie test-plan. Kandydaci na ryzyko wynikające wprost z Guardrails:
  izolacja danych między kontami, niemożność utrwalenia drużyny poniżej progu, rozwiązywalność
  puli postaci.
- Rozwiązywalność puli 10–12 postaci jest warunkiem danych początkowych i podlega weryfikacji
  testem — patrz `## Business Logic`.
