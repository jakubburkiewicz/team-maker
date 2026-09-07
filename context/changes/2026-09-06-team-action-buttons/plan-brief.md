# Ikonowe akcje na liście drużyn i uporządkowane akcje w edytorze — Krótki plan

> Pełny plan: `context/changes/2026-09-06-team-action-buttons/plan.md`
> Zgłoszenie i rozstrzygnięcia: `context/changes/2026-09-06-team-action-buttons/change.md`

## Co i dlaczego

Wiersz listy drużyn na `/` nie daje dziś żadnej akcji poza wejściem w drużynę, a na stronie edycji
brakuje wyruszenia i „Delete team" wisi pod całą siatką, poza kontekstem. Dokładamy trzy ikonowe
akcje w wierszu listy (Embark / Edit / Delete, bez etykiet — pkt 6 zgłoszenia) i porządkujemy
komplet akcji w kolumnie bocznej edytora (pkt 7).

## Punkt wyjścia

Lista mieszka na `/` po `teams-list-as-home`, każdy wiersz jest jednym wielkim `<a>`, a strona jest
czystym SSR — zero `client:*`. Usuwanie działa i ma okno potwierdzenia (`delete-team-confirmed`),
ale komponent jest samowystarczalny: sam trzyma stan otwarcia i sam renderuje swój przycisk. Skład
drużyny żyje wyłącznie w pamięci wyspy `TeamComposer`, więc nic poza nią nie wie o niezapisanych
zmianach.

## Pożądany stan końcowy

Na `/` każdy wiersz pokazuje nazwę-hash jako link, datę zapisu i trzy ikony z nazwami dostępnymi
i dymkami; usunięcie prowadzi przez jedno okno potwierdzenia na całą listę. Na `/teams/[id]`
kolumna boczna zbiera komplet akcji drużyny — Save changes, Embark on the job, Delete team —
a Embark odmawia, dopóki widoczny skład różni się od zapisanego. Ekran `/teams/<id>/embark` mówi
prawdę o obu wejściach: po zapisie i z listy.

## Kluczowe podjęte decyzje

| Decyzja                        | Wybór                                              | Dlaczego                                                                                         |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Struktura wiersza listy        | Karta bez linku, nazwa-hash jako link              | Jedyny układ bez zagnieżdżonych elementów interaktywnych — poprawny HTML i przewidywalny Tab      |
| Delete na liście               | Jedna wyspa nad całą listą, jedno okno w DOM       | FR-006 nie stawia limitu drużyn; wyspa per wiersz skalowałaby hydratację liniowo                 |
| Embark z listy                 | Link na `/teams/<id>/embark` + przeredagowany ekran | Jedna trasa obsługuje oba wejścia; dzisiejsze „Team X is saved" kłamałoby przy wejściu z listy    |
| Embark a niezapisane zmiany    | Zablokowany, dopóki skład różni się od zapisanego  | Zero cichej utraty pracy przy zerowych zmianach w trasach zapisu — porównanie to czysta funkcja  |
| Układ akcji w edytorze         | Wszystko w kolumnie bocznej pod bramką progu       | Delete wraca w kontekst, a `CompositionGate` — jedyny strażnik progu w interfejsie — zostaje cały |
| Etykiety                       | Ikona + tekst w edytorze, sama ikona na liście     | Pkt 6 wymaga ikon tylko w wierszu; nieodwracalny Delete w edytorze mówi wprost, co robi          |
| Dostępność ikon                | `aria-label` z nazwą drużyny + natywny `title`     | Zero nowych zależności; nazwa w etykiecie rozróżnia wiersze przy kilku drużynach                 |
| Zakres testów                  | `team-actions.ts` + porównanie składów, oba czyste | Realne pokrycie zamiast strażników grepowych, przed którymi trzykrotnie ostrzega `lessons.md`     |

## Zakres

**W zakresie:**

- Trzy ikonowe akcje w wierszu listy na `/`, z nazwami dostępnymi i dymkami
- Jedna wyspa listy z jednym oknem potwierdzenia usunięcia
- Grupa akcji (Save / Embark / Delete) w kolumnie bocznej `/teams/[id]`
- Blokada Embark przy niezapisanych zmianach składu
- Rozdzielenie `DeleteTeamDialog` na sterowane okno i osobny wyzwalacz
- Przeredagowanie treści `/teams/[id]/embark` pod dwa wejścia
- Dwa czyste moduły w `src/lib/` wraz z testami

**Poza zakresem:**

- Jakakolwiek zmiana w `/teams/new`
- Jakakolwiek zmiana w trasach zapisu, bramce progu, regule domenowej, schemacie bazy i RLS
- „Zapisz i wyrusz" jednym kliknięciem
- Prymityw tooltip z shadcn
- Nowy ekran wyruszenia i zmiana trasy
- Responsywność mobilna i audyt WCAG-AA (Non-Goals PRD)

## Architektura / Podejście

Dwa czyste moduły w `src/lib/` niosą całą nową logikę: `team-actions.ts` opisuje trzy akcje
(adresy, etykiety, nazwy dostępne) jako unię rozróżnialną, w której „delete jako link" jest
niereprezentowalne, a `composition-changes.ts` odpowiada na jedno pytanie — czy widoczny skład
różni się od zapisanego, porównując **zbiorowo**, nie pozycyjnie. Oba są testowalne bez Astro
i Supabase, zgodnie z twardą regułą repo, i oba są konsumowane przez dwa ekrany naraz, więc
rozjazd między listą a edytorem czerwieni się w `npm test`.

Warstwa widoku: `TeamList.tsx` (jedna wyspa nad listą, jedno okno) i `TeamActions.tsx` (grupa akcji
wewnątrz wyspy kompozytora, bo tylko ona zna niezapisane zmiany). `DeleteTeamDialog` staje się
sterowany, a jego dotychczasowe zachowanie „przycisk + własny stan" przenosi się do
`DeleteTeamButton.tsx`, którego jedynym konsumentem jest gałąź awarii `/teams/[id]`.

## Fazy w skrócie

| Faza                                        | Co dostarcza                                                                     | Kluczowe ryzyko                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Fundament i treść ekranu wyruszenia      | Dwa czyste moduły z testami; ekran wyruszenia prawdziwy dla obu wejść             | Redakcja tekstu objętego FR-019 musi dalej potwierdzać **trwałość** zapisu, nie tylko unikać kłamstwa   |
| 2. Akcje w kolumnie bocznej edytora         | Sterowane okno; Save / Embark / Delete razem; Embark blokowany przy zmianach      | Dwa przyciski usuwania (gałąź sukcesu i awarii) muszą być strukturalnie wykluczone, nie zgodne warunkiem |
| 3. Ikonowe akcje w wierszu listy            | Przebudowany wiersz; jedna wyspa z trzema ikonami i jednym oknem                  | Wspólne okno musi nazywać **kliknięty** wiersz — zapamiętany cel jest cichą awarią przy usuwaniu        |

**Wymagania wstępne:** zamknięte `teams-list-as-home`, `app-shell-header-nav`
i `delete-team-confirmed` (wszystkie w `context/archive/`); Node 22.14.0 przez `nvm use && hash -r`
przed `npx astro sync`.
**Szacowany wysiłek:** ~3 sesje, po jednej na fazę.

## Otwarte ryzyka i założenia

- Strażniki grepowe tego planu opisują pliki w stanie **po** dwóch zamkniętych zmianach. Każdy
  negatywny musi zostać uruchomiony na commicie bazowym i czerwienić się tam — inaczej pilnuje
  czegoś, czego już nie ma (`lessons.md`, trzy osobne lekcje o tej klasie).
- Przeniesienie akcji do kolumny bocznej zagęszcza ją: wykres, licznik braków i trzy akcje jedno
  pod drugim. Jeśli ręczna weryfikacja pokaże, że kolumna jest za ciasna, układ jest jedyną rzeczą
  do skorygowania — logika i umowy modułów zostają.
- Strona główna przestaje działać bez JavaScriptu. Przyjęte świadomie jako cena okna potwierdzenia
  (FR-010); nie ma tu ścieżki bez tego kosztu poza rezygnacją z Delete w wierszu.
- Komponenty React i strony `.astro` pozostają bez testów — repo nie ma runnera DOM, a jego
  dołożenie należy do Modułu 3. Ryzyko przenosi się na ręczną ścieżkę weryfikacji.

## Kryteria sukcesu (podsumowanie)

- Z listy drużyn można wyruszyć, wejść w edycję i usunąć drużynę, nie opuszczając wiersza — każdą
  akcję da się nazwać przed kliknięciem, dymkiem i czytnikiem ekranu.
- Na stronie edycji komplet akcji stoi w jednym miejscu, a wyruszenie nie potrafi cicho porzucić
  niezapisanej pracy gracza.
- Cała dotychczasowa pętla CRUD, izolacja między kontami i bramka progu zachowują się dokładnie
  jak przed zmianą.
